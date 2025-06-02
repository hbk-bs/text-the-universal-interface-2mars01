// Debate configuration
const debateConfig = {
	apiEndpoint: 'https://onmars--aaa7a55dacaa4ff1be82c0987204a122.web.val.run',
	maxExchanges: 10,
	exchangeDelay: 1500, // ms between exchanges
	intraExchangeDelay: 3000, // ms delay between protagonist and antagonist in the same turn
	systemPrompt: `You are facilitating a philosophical debate between two characters:
	
	PROTAGONIST (Optimist):
	- Believes life has inherent meaning
	- Views challenges as opportunities for growth
	- Argues with hope and compassion
	
	ANTAGONIST (Nihilist):
	- Sees existence as fundamentally meaningless
	- Questions all assumptions about purpose
	- Uses logical arguments and sharp wit
	- Gets more and more cynical as the debate progresses
	
	RULES:
	1. Alternate responses between characters
	2. Keep responses concise (1-2 sentences)
	3. Reference previous points
	4. Generate exchanges automatically
	5. Format responses as JSON: {protagonist:"", antagonist:""}`
  };
  
  // State management
  let debateState = {
	history: [],
	exchangeCount: 0,
	isDebating: false
  };
  
  // DOM elements
  let elements = {};
  
  // Function to start the debate
  async function startDebate() {
	elements.startButton.disabled = true;
	elements.resetButton.disabled = true;
	debateState.isDebating = true;
	
	while (debateState.isDebating && debateState.exchangeCount < debateConfig.maxExchanges) {
	  await new Promise(resolve => setTimeout(resolve, debateConfig.exchangeDelay));
	  
	  try {
		const response = await fetch(debateConfig.apiEndpoint, {
		  method: 'POST',
		  headers: { 'Content-Type': 'application/json' },
		  body: JSON.stringify({ 
			response_format: { type: 'json_object' },
			messages: debateState.history
		  })
		});
  
		if (!response.ok) {
		  throw new Error(await response.text());
		}
  
		const json = await response.json();
		const newMessage = json.completion.choices[0].message;
		
		debateState.history.push(newMessage); // Still store the full message for history integrity
		debateState.exchangeCount++;

		// Staged rendering of the new message parts
		try {
			const parsedContent = JSON.parse(newMessage.content); // newMessage.content is '{"protagonist": "...", "antagonist": "..."}'
			
			if (parsedContent.protagonist) {
				const protagonistDiv = document.createElement('div');
				protagonistDiv.className = 'message protagonist';
				// Basic text escaping, adjust if you expect HTML content from LLM
				protagonistDiv.textContent = parsedContent.protagonist; 
				elements.chatHistory.appendChild(protagonistDiv);
				scrollToBottom();
			}

			// Wait before showing the antagonist's response
			await new Promise(resolve => setTimeout(resolve, debateConfig.intraExchangeDelay));

			if (parsedContent.antagonist) {
				const antagonistDiv = document.createElement('div');
				antagonistDiv.className = 'message antagonist';
				// Basic text escaping
				antagonistDiv.textContent = parsedContent.antagonist;
				elements.chatHistory.appendChild(antagonistDiv);
				scrollToBottom();
			}

		} catch (parseError) {
			console.error('Error parsing or rendering message content:', parseError, newMessage.content);
			// Fallback: render the raw content or an error message directly
			const errorDisplayDiv = document.createElement('div');
			errorDisplayDiv.className = 'message system-error'; // Or 'assistant' if you want to show raw
			errorDisplayDiv.textContent = `Error displaying exchange: ${newMessage.content}`;
			elements.chatHistory.appendChild(errorDisplayDiv);
			scrollToBottom();
		}
		// Note: renderDebateHistory() is NOT called here anymore for each new message.
		// It's used for full rebuilds (e.g., by resetDebate or init if needed).
		
	  } catch (error) {
		console.error('API Error:', error);
		renderSystemMessage('Debate paused due to error');
		debateState.isDebating = false;
	  }
	}
	
	if (debateState.exchangeCount >= debateConfig.maxExchanges) {
	  renderSystemMessage(`The debate has concluded after ${debateConfig.maxExchanges} exchanges.`);
	}
	
	elements.resetButton.disabled = false;
	debateState.isDebating = false;
  }
  
  // Function to reset the debate
  function resetDebate() {
	debateState = {
	  history: [
		{ role: 'system', content: debateConfig.systemPrompt }
	  ],
	  exchangeCount: 0,
	  isDebating: false
	};
	
	elements.chatHistory.innerHTML = '';
	elements.startButton.disabled = false;
	elements.resetButton.disabled = true;
  }
  
  // Function to render the debate history
  function renderDebateHistory() {
	elements.chatHistory.innerHTML = debateState.history
	  .map(message => {
		if (message.role === 'system') return '';
		
		try {
		  const content = JSON.parse(message.content);
		  return `
			<div class="message protagonist">${content.protagonist}</div>
			<div class="message antagonist">${content.antagonist}</div>
		  `;
		} catch {
		  return '';
		}
	  })
	  .join('');
	
	scrollToBottom();
  }
  
  // Function to render system messages
  function renderSystemMessage(text) {
	elements.chatHistory.innerHTML += `
	  <div class="message system">${text}</div>
	`;
	scrollToBottom();
  }
  
  // Function to scroll to bottom of chat history
  function scrollToBottom() {
	elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
  }
  
  // Initialize the application
  function init() {
	// Get DOM elements
	elements = {
	  chatHistory: document.querySelector('.chat-history'),
	  startButton: document.querySelector('#start-button'),
	  resetButton: document.querySelector('#reset-button')
	};
  
	// Verify elements exist
	if (!elements.chatHistory || !elements.startButton || !elements.resetButton) {
	  console.error('Missing required elements:', {
		chatHistory: !!elements.chatHistory,
		startButton: !!elements.startButton,
		resetButton: !!elements.resetButton
	  });
	  return;
	}
  
	// Set up event listeners
	elements.startButton.addEventListener('click', startDebate);
	elements.resetButton.addEventListener('click', resetDebate);
	
	// Initialize debate history with system prompt
	debateState.history = [
	  { role: 'system', content: debateConfig.systemPrompt }
	];
	
	// Enable start button
	elements.startButton.disabled = false;
	elements.resetButton.disabled = true;
  }
  
  // Wait for DOM to be fully loaded before initializing
  if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
  } else {
	init();
  }