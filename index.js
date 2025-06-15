// @ts-check

// Configuration
const API_ENDPOINT = 'https://onmars--aaa7a55dacaa4ff1be82c0987204a122.web.val.run/';
const MAX_HISTORY_LENGTH = 10; // For truncating message history sent to AI
const FETCH_INTERVAL_MS = 10000; // Interval for fetching new messages
const EXCHANGES_BEFORE_MODERATOR = 7; // Approx 7 AI responses + 7 user responses = 14 texts before moderator. Adjust as needed.

// Define topics
const topics = [
    { 
        id: "zebraStripes", 
        displayName: "Zebra Stripes: Black on White or White on Black?", 
        initialUserQuery: "The eternal question: Are zebras white with black stripes, or black with white stripes? Present your irrefutable argument!" 
    },
    { 
        id: "hotdogSandwich", 
        displayName: "Is a Hotdog a Sandwich?", 
        initialUserQuery: "Alright, settle it once and for all: is a hotdog a sandwich? I need a definitive, well-reasoned answer." 
    },
    { 
        id: "cerealSoup", 
        displayName: "Is Cereal a Soup?", 
        initialUserQuery: "Controversial opinion time: Is cereal technically a type of soup? Defend your position with gusto!" 
    },
    {
        id: "flatEarth",
        displayName: "Convince Me the Earth is Flat",
        initialUserQuery: "I'm feeling open-minded today. Try to convince me the Earth is flat. What's your most compelling 'evidence'?"
    }
];

// Moderator Prompt
const MODERATOR_SYSTEM_PROMPT_TEMPLATE = `You are an impartial and insightful moderator. 
The following is a debate on the topic of "{TOPIC}". 
Please provide a concise (3sentences) summary of the main arguments presented by both sides and perhaps a lighthearted concluding thought.
Your response should be plain text, not JSON.`;

let currentTopic = null;
let debateIntervalId = null;
let exchangeCount = 0; // To count AI responses

let messageHistory = {
    response_format: { type: 'json_object' },
    temperature: 0.9,
    max_tokens: 250, // For regular debate turns
    messages: []
};

// DOM elements
let elements = {
    chatHistory: null,
    loadingIndicator: null,
    topicSelectionContainer: null,
    newTopicButton: null // ADDED for the new button
};

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    elements.chatHistory = document.querySelector('.chat-history');
    elements.loadingIndicator = document.getElementById('loadingIndicator');
    elements.topicSelectionContainer = document.getElementById('topicSelectionContainer');
    elements.newTopicButton = document.getElementById('newTopicButton'); // Get the new button

    if (!elements.chatHistory || !elements.topicSelectionContainer || !elements.newTopicButton) {
        console.error('Critical DOM elements .chat-history, #topicSelectionContainer, or #newTopicButton are missing.');
        alert('Error: Page elements missing. The application cannot start.');
        return;
    }

    renderTopicButtons();
    elements.newTopicButton.addEventListener('click', handleNewTopicRequest); // Add event listener
});

function renderTopicButtons() {
    if (!elements.topicSelectionContainer) return;
    elements.topicSelectionContainer.innerHTML = '<h2>Choose a Topic to Start:</h2>';
    topics.forEach(topic => {
        const button = document.createElement('button');
        button.className = 'topic-button';
        button.textContent = topic.displayName;
        button.addEventListener('click', () => startDebateWithTopic(topic));
        elements.topicSelectionContainer.appendChild(button);
    });
    elements.topicSelectionContainer.style.display = 'block'; // Ensure topics are visible initially
    if (elements.chatHistory) elements.chatHistory.style.display = 'none'; // Hide chat initially
    if (elements.newTopicButton) elements.newTopicButton.style.display = 'none'; // Hide new topic button initially
}

function startDebateWithTopic(topic) {
    currentTopic = topic;
    exchangeCount = 0; // Reset exchange count for the new topic
    if (elements.topicSelectionContainer) elements.topicSelectionContainer.style.display = 'none';
    if (elements.chatHistory) {
        elements.chatHistory.innerHTML = ''; // Clear previous chat
        elements.chatHistory.style.display = 'block'; // Make chat visible
    }
    if (elements.newTopicButton) elements.newTopicButton.style.display = 'inline-block'; // Show the "New Topic" button

    messageHistory.messages = [
        {
            role: 'system',
            content: `You are in a debate with an antagonist about "${currentTopic.displayName}".
            The 'user' message is the antagonist's previous point. You must counter it.
            Give the antagonist a hard time! Keep your responses concise. 2 sentences max.
            Respond in JSON format: {"response": "Your debate point here."}`
        },
        {
            role: 'user',
            content: `{"response":"${currentTopic.initialUserQuery}"}`
        }
    ];

    renderChatMessages();
    scrollToBottom();

    if (debateIntervalId) {
        clearInterval(debateIntervalId);
        debateIntervalId = null;
    }

    debateIntervalId = setInterval(async () => {
        if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'block';

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageHistory), 
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error Response:", errorText);
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const json = await response.json();
            const assistantMessage = json.completion?.choices?.[0]?.message; 
            
            if (!assistantMessage || typeof assistantMessage.content !== 'string') {
                console.error("Unexpected API response structure or missing content:", json);
                throw new Error("Assistant's message not found or invalid in API response.");
            }
            
            messageHistory.messages.push(assistantMessage);
            exchangeCount++; // Increment after a successful AI response
            truncateCurrentHistory();

            renderChatMessages();
            scrollToBottom();

            // Check if it's time for the moderator
            if (exchangeCount >= EXCHANGES_BEFORE_MODERATOR) {
                clearInterval(debateIntervalId);
                debateIntervalId = null;
                renderSystemMessage("The debate has reached peak silliness. The moderator will now summarize.");
                await generateModeratorConclusion();
                // Optionally re-show topic buttons or add a reset button
                if(elements.topicSelectionContainer) elements.topicSelectionContainer.style.display = 'block';
                return; // Stop further debate turns
            }

            // Role swapping logic
            messageHistory.messages = messageHistory.messages.map((message) => {
                if (message.role === 'assistant') {
                    return { ...message, role: 'user' }; 
                } else if (message.role === 'user') {
                    return { ...message, role: 'assistant' };
                }
                return message;
            });

        } catch (error) {
            console.error('Error during interval fetch:', error);
            if (elements.chatHistory) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message error';
                errorDiv.textContent = `Error: ${error.message}. Auto-refresh paused.`;
                elements.chatHistory.appendChild(errorDiv);
                scrollToBottom();
            }
            if (debateIntervalId) clearInterval(debateIntervalId); 
            debateIntervalId = null; 
            if (elements.newTopicButton) elements.newTopicButton.style.display = 'inline-block'; // Show "New Topic" button on error
        } finally {
            if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'none';
        }
    }, FETCH_INTERVAL_MS);
}

// NEW function to handle "Choose New Topic" button click
function handleNewTopicRequest() {
    if (debateIntervalId) { // Stop current debate if active
        clearInterval(debateIntervalId);
        debateIntervalId = null;
    }
    currentTopic = null; // Reset current topic
    messageHistory.messages = []; // Clear message history

    if (elements.chatHistory) {
        elements.chatHistory.innerHTML = ''; // Clear chat display
        elements.chatHistory.style.display = 'none'; // Hide chat display
    }
    if (elements.topicSelectionContainer) {
        elements.topicSelectionContainer.style.display = 'block'; // Show topic buttons
    }
    if (elements.newTopicButton) {
        elements.newTopicButton.style.display = 'none'; // Hide "New Topic" button until a new debate starts
    }
    renderSystemMessage("Please choose a new topic."); // Optional message
}

async function generateModeratorConclusion() {
    if (!currentTopic) return;
    if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'block';
    renderSystemMessage("Moderator is thinking...");

    // Prepare the debate transcript for the moderator
    // We'll send the system prompt for the debate and all user/assistant messages
    const transcriptMessages = messageHistory.messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    
    // Create a simplified transcript string
    let transcriptString = `Debate on "${currentTopic.displayName}":\n`;
    transcriptMessages.forEach(msg => {
        let speaker = msg.role === 'user' ? "Challenger" : "AI Debater"; // Or however you want to label them
        let content = msg.content;
        try {
            const parsed = JSON.parse(content);
            if(parsed.response) content = parsed.response;
        } catch(e) { /* ignore if not JSON */ }
        transcriptString += `${speaker}: ${content}\n`;
    });

    const moderatorApiMessages = [
        {
            role: 'system',
            content: MODERATOR_SYSTEM_PROMPT_TEMPLATE.replace("{TOPIC}", currentTopic.displayName)
        },
        {
            role: 'user',
            content: transcriptString
        }
    ];

    try {
        const response = await fetch(API_ENDPOINT, { // Using the same API endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // For moderator, we might not need response_format: json_object if it's plain text
                // response_format: { type: 'text' }, // Or remove if API defaults to text or handles it
                messages: moderatorApiMessages,
                temperature: 0.5, // Moderator can be more factual
                max_tokens: 200  // For a summary
            }),
        });
        if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'none';

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Moderator API Error Response:", errorText);
            throw new Error(`Moderator API request failed: ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        const summary = json.completion?.choices?.[0]?.message?.content;

        if (summary) {
            appendMessageToChat('moderator', summary); // Use a new role for styling
        } else {
            appendMessageToChat('error', "Moderator could not provide a summary.");
            console.error("Moderator summary missing in response:", json);
        }

    } catch (error) {
        if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'none';
        console.error('Error generating moderator conclusion:', error);
        appendMessageToChat('error', `Moderator error: ${error.message}`);
    }
}


// --- Helper Functions ---
function renderChatMessages() {
    if (!elements.chatHistory) return;
    const htmlStrings = messageHistory.messages.map((message) => {
        if (message.role === 'system') {
            // Optionally display system messages for debugging or context
            // return `<div class="message system"><p>${message.content.replace(/\n/g, "<br>")}</p></div>`;
            return '';
        }
        let displayContent = message.content;
        try {
            const parsed = JSON.parse(message.content);
            if (parsed && typeof parsed.response === 'string') {
                displayContent = parsed.response;
            }
        } catch (e) { /* Content is not valid JSON, display as is */ }
        
        const escapedDisplayContent = displayContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        return `<div class="message ${message.role}"><p>${escapedDisplayContent}</p></div>`;
    });
    elements.chatHistory.innerHTML = htmlStrings.join('');
}

function scrollToBottom() {
    if (elements.chatHistory) {
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
    }
}

function truncateCurrentHistory() {
    if (!messageHistory || !messageHistory.messages || messageHistory.messages.length <= 1) {
        return;
    }
    const systemMessage = messageHistory.messages[0];
    let conversationMessages = messageHistory.messages.slice(1);
    if (conversationMessages.length > MAX_HISTORY_LENGTH) {
        conversationMessages = conversationMessages.slice(-MAX_HISTORY_LENGTH);
        messageHistory.messages = [systemMessage, ...conversationMessages];
    }
}

// Helper to append messages (can be used by moderator too)
function appendMessageToChat(role, text) {
    if (!elements.chatHistory) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`; // Ensure you have CSS for .message.moderator
    const p = document.createElement('p');
    p.textContent = text;
    messageDiv.appendChild(p);
    elements.chatHistory.appendChild(messageDiv);
    scrollToBottom();
}

function renderSystemMessage(text) {
    if (!elements.chatHistory) return;
    const systemDiv = document.createElement('div');
    systemDiv.className = 'message system';
    systemDiv.textContent = text;
    elements.chatHistory.appendChild(systemDiv);
    scrollToBottom();
}