// @ts-check

// Configuration
const API_ENDPOINT = 'https://onmars--aaa7a55dacaa4ff1be82c0987204a122.web.val.run/'; // Oder dein anderer Endpunkt
const MAX_HISTORY_LENGTH = 10; // Für die reguläre Debatte
const FETCH_INTERVAL_MS = 10000;
const EXCHANGES_BEFORE_MODERATOR = 3; // REDUZIERT FÜR SCHNELLERES TESTEN (z.B. 3 KI-Antworten)

// FESTE Themen
const topics = [
    { id: "zebraStripes", displayName: "Zebra Stripes", initialUserQuery: "Are zebras white with black stripes or vice versa?" },
    { id: "hotdogSandwich", displayName: "Hotdog a Sandwich?", initialUserQuery: "Settle it: is a hotdog a sandwich?" },
    { id: "cerealSoup", displayName: "Is Cereal a Soup?", initialUserQuery: "Controversial opinion time: Is cereal technically a type of soup? Defend your position with gusto!" },
];

const MODERATOR_SYSTEM_PROMPT_TEMPLATE = `You are an impartial and witty moderator.
The following is a transcript of a debate on the topic of "{TOPIC}".
Your task is to provide a concise (2-4 sentences) and engaging summary of the main arguments or funny points presented.
Do not declare a winner. Your response should be plain text.`;

let currentTopic = null;
let debateIntervalId = null;
let exchangeCount = 0; // Zählt die Antworten des 'assistant' (KI)

let messageHistory = {
    response_format: { type: 'json_object' }, // Für die Debatten-KI
    temperature: 0.7,
    max_tokens: 250, // Für Debatten-Antworten
    messages: []
};

let elements = {
    chatHistory: null,
    loadingIndicator: null,
    topicSelectionContainer: null,
    newTopicButton: null
};

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    elements.chatHistory = document.querySelector('.chat-history');
    elements.loadingIndicator = document.getElementById('loadingIndicator');
    elements.topicSelectionContainer = document.getElementById('topicSelectionContainer');
    elements.newTopicButton = document.getElementById('newTopicButton');

    if (!elements.chatHistory || !elements.topicSelectionContainer || !elements.newTopicButton) {
        console.error('Critical DOM elements missing.');
        alert('Error: Page elements missing. The application cannot start.');
        return;
    }
    renderTopicButtons();
    elements.newTopicButton.addEventListener('click', handleNewTopicRequest);
});

// --- Function Definitions ---

function renderTopicButtons() {
    if (!elements.topicSelectionContainer) return;
    elements.topicSelectionContainer.innerHTML = '<h2>Choose a topic to start:</h2>';
    topics.forEach(topic => {
        const button = document.createElement('button');
        button.className = 'topic-button';
        button.textContent = topic.displayName;
        button.addEventListener('click', () => startDebateWithTopic(topic));
        elements.topicSelectionContainer.appendChild(button);
    });
    elements.topicSelectionContainer.style.display = 'block';
    if (elements.chatHistory) elements.chatHistory.style.display = 'none';
    if (elements.newTopicButton) elements.newTopicButton.style.display = 'none';
}

async function startDebateWithTopic(topic) {
    currentTopic = topic;
    exchangeCount = 0; // Wichtig: Zähler zurücksetzen
    if (elements.topicSelectionContainer) elements.topicSelectionContainer.style.display = 'none';
    if (elements.chatHistory) {
        elements.chatHistory.innerHTML = '';
        elements.chatHistory.style.display = 'block';
    }
    if (elements.newTopicButton) elements.newTopicButton.style.display = 'inline-block';

    messageHistory.messages = [
        {
            role: 'system',
            content: `You are in a debate with an antagonist about "${currentTopic.displayName}".
            The 'user' message is the antagonist's previous point. You must counter it.
            Give the antagonist a hard time! Be sassy, be a little rude. Tease the antagonist. Keep your responses concise.
            Respond in JSON format: {"response": "Your debate point here."}`
        },
        {
            role: 'user', // Die erste Nachricht ist vom "Benutzer" (Initiator)
            content: `{"response":"${currentTopic.initialUserQuery}"}`
        }
    ];

    renderChatMessages();
    scrollToBottom();

    if (debateIntervalId) clearInterval(debateIntervalId);
    debateIntervalId = null;

    debateIntervalId = setInterval(async () => {
        if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'block';
        try {
            const payloadForAPI = { ...messageHistory }; // Sendet das messageHistory-Objekt direkt

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadForAPI), 
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const json = await response.json();
            const assistantApiResponse = json.completion?.choices?.[0]?.message; 
            
            if (!assistantApiResponse || typeof assistantApiResponse.content !== 'string') {
                throw new Error("Assistant's message not found or invalid in API response.");
            }
            
            // Die neue Nachricht von der KI hat die API-Rolle 'assistant'
            messageHistory.messages.push(assistantApiResponse);
            exchangeCount++; // Zähle die Antwort der KI
            truncateCurrentHistory();
            renderChatMessages();
            scrollToBottom();

            // Prüfe, ob der Moderator an der Reihe ist
            if (exchangeCount >= EXCHANGES_BEFORE_MODERATOR) {
                clearInterval(debateIntervalId);
                debateIntervalId = null;
                renderSystemMessage("The debate has reached its conclusion. The moderator will now summarize.");
                await generateModeratorConclusion(); // Rufe den Moderator auf
                // UI nach Moderation zurücksetzen
                if(elements.topicSelectionContainer) elements.topicSelectionContainer.style.display = 'block';
                if(elements.newTopicButton) elements.newTopicButton.style.display = 'none'; // Verstecke "New Topic"
                return; // Stoppe weitere Debatten-Turns für dieses Thema
            }

            // Rollentausch-Logik: Ändert die 'role' für den nächsten API-Aufruf
            messageHistory.messages = messageHistory.messages.map((message) => {
                if (message.role === 'system') return message;
                const nextApiRole = (message.role === 'assistant') ? 'user' : 'assistant';
                return { ...message, role: nextApiRole };
            });

        } catch (error) {
            console.error('Error during interval fetch:', error);
            renderSystemMessage(`Error: ${error.message}. Auto-refresh paused.`);
            if (debateIntervalId) clearInterval(debateIntervalId); 
            debateIntervalId = null; 
            if (elements.newTopicButton) elements.newTopicButton.style.display = 'inline-block'; 
        } finally {
            if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'none';
        }
    }, FETCH_INTERVAL_MS);
}

function handleNewTopicRequest() {
    if (debateIntervalId) clearInterval(debateIntervalId);
    debateIntervalId = null;
    currentTopic = null;
    messageHistory.messages = [];
    exchangeCount = 0;

    if (elements.chatHistory) {
        elements.chatHistory.innerHTML = '';
        elements.chatHistory.style.display = 'none';
    }
    if (elements.topicSelectionContainer) elements.topicSelectionContainer.style.display = 'block';
    if (elements.newTopicButton) elements.newTopicButton.style.display = 'none';
}

function renderChatMessages() {
    if (!elements.chatHistory) return;
    const displayableMessages = messageHistory.messages.filter(msg => msg.role !== 'system');
    const htmlStrings = displayableMessages.map((message, index) => {
        const roleForCSS = (index % 2 === 0) ? 'user' : 'assistant';
        let displayContent = message.content;
        try {
            const parsed = JSON.parse(message.content);
            if (parsed && typeof parsed.response === 'string') displayContent = parsed.response;
        } catch (e) { /* ignore */ }
        const escapedDisplayContent = displayContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="message ${roleForCSS}"><p>${escapedDisplayContent}</p></div>`;
    });
    elements.chatHistory.innerHTML = htmlStrings.join('');
}

function scrollToBottom() {
    if (elements.chatHistory) elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

function truncateCurrentHistory() {
    if (!messageHistory || !messageHistory.messages || messageHistory.messages.length <= 1) return;
    const systemMessage = messageHistory.messages[0]; // Behalte den ursprünglichen System-Prompt der Debatte
    let conversationMessages = messageHistory.messages.slice(1);
    if (conversationMessages.length > MAX_HISTORY_LENGTH) {
        conversationMessages = conversationMessages.slice(-MAX_HISTORY_LENGTH);
        messageHistory.messages = [systemMessage, ...conversationMessages];
    }
}

function renderSystemMessage(text) {
    if (!elements.chatHistory) return;
    if (elements.chatHistory.style.display === 'none' && text.includes("Please choose")) return; 
    const systemDiv = document.createElement('div');
    systemDiv.className = 'message system';
    systemDiv.textContent = text;
    elements.chatHistory.appendChild(systemDiv);
    scrollToBottom();
}

async function generateModeratorConclusion() {
    if (!currentTopic) {
        console.error("Moderator: No current topic to summarize.");
        return;
    }
    renderSystemMessage("Moderator is contemplating the arguments..."); // Eigene Systemnachricht
    if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'block';}