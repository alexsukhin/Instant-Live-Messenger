import {getConnectionID, getSessionID, getConversationID, getSenderID, appendMessage, appendImage, appendFile} from "./functions.js";
import {encryptionManager} from "./encryption.js";
import {openDatabase, saveKey, getPrivateKey} from "./indexeddb.js";

let sessionSocket;
let chatUserElements = [];

async function initiateSession(recipientID, conversationID, encryptedAESKey) {

    //Inserts a session into sessions database
    const insertSessionResponse = await fetch(`/insert-session/${conversationID}/${encryptedAESKey}`);
    const insertSessionData = await insertSessionResponse.json();

    //Connects and establishes a session websocket for current user
    sessionSocket = io.connect('http://127.0.0.1:5000');

    sessionSocket.on('connect', () => {
        //Establishes a web socket when user clicks on a user, resetting notification count
        console.log('WebSocket connection established');

        sessionSocket.emit('join-room', recipientID)

        sessionSocket.emit('reset-notification', recipientID)

    });


    sessionSocket.on('message', async (message) => {

        const senderID = await getSenderID();

        const chatMessages = document.getElementById("chatbox-messages");

        //Appends a message into HTML in real-time
        appendMessage(message, senderID, chatMessages)

        
    })

    sessionSocket.on('file', async (file) => {

        const senderID = await getSenderID();

        const chatMessages = document.getElementById("chatbox-messages");
        
        //Appends a file/message into HTML in real-time
        if (file.dataFormat == "text/plain" || file.dataFormat == "application/pdf") {

            appendFile(file, senderID, chatMessages)
            
        } else if (file.dataFormat == "image/png" || file.dataFormat == "image/jpeg") {

            appendImage(file, senderID, chatMessages)

        }
    })

    sessionSocket.on('reset-notification', () => {

        //Gets user element which user clicked on
        let chatUserElement = chatUserElements.find(element => element.dataset.userId === recipientID);

        //Gets notification element from current chat user element
        const notificationCounterElement = chatUserElement.querySelector("h2");

        //Sets text content to an empty string, representing '0' i.e no notifications
        notificationCounterElement.textContent = "";

    })
    
};

async function updateChatList() {

    //Gets list of all chat users into data variable via JSON
    const response = await fetch("/get-chat-users");
    const data = await response.json();

        //Loops through each chat user
        data.forEach(user => {

            //Gets user element which user clicked on
            let chatUserElement = chatUserElements.find(element => element.dataset.userId === user.userID);
            
            //Creates and pushes a chat user element via HTML if there is no pre-existing chat user element for user
            if (!chatUserElement) {
                chatUserElement = document.createElement("div");
                chatUserElement.className = "chat-user";
                chatUserElement.dataset.userId = user.userID;

                const usernameElement = document.createElement("h");
                const firstNameElement = document.createElement("h");   
                const lastNameElement = document.createElement("h");
                const notificationCounterElement = document.createElement("h2");
                const spaceElement = document.createTextNode(" ");
                const br = document.createElement("br");
                const hr = document.createElement("hr");
    
                usernameElement.textContent = user.username;
                firstNameElement.textContent = user.firstName;
                lastNameElement.textContent = user.lastName;

                if (user.notificationCounter !== 0) {
                    notificationCounterElement.textContent = user.notificationCounter;
                }
    
                chatUserElement.appendChild(usernameElement);
                chatUserElement.appendChild(notificationCounterElement);
                chatUserElement.appendChild(br);
                chatUserElement.appendChild(firstNameElement);
                chatUserElement.appendChild(spaceElement);
                chatUserElement.appendChild(lastNameElement);
                chatUserElement.appendChild(hr);


                chatUserElements.push(chatUserElement);
            }
                
        });

        // Determines the desired order based on the fetched data
        const desiredOrder = data.map(user => user.userID);
        const chatList = document.getElementById("chat-list");

        // Reorders chat user elements in chatList based on desired order
        desiredOrder.forEach(userId => {
            const chatUserElement = chatUserElements.find(element => element.dataset.userId === userId.toString());
            if (chatUserElement) {
                chatList.appendChild(chatUserElement);
            }
        });



};

async function updateUser(recipientID) {
    //Inserts into conversation and session databases when user selects a user to communicate with

    //Disconnects from current session websocket once user selects a different user to communicate with
    if (sessionSocket) {
        sessionSocket.disconnect()
        console.log('Websocket disconnected')
    }

    const encryptedAESKey = "test";

    const connectionID = await getConnectionID(recipientID);

    //Checks if there is a connection between two users
    if (connectionID !== null) {

        const conversationCheckResponse = await fetch(`/check-conversation/${connectionID}`);
        const conversationCheckData = await conversationCheckResponse.json();



        //Checks if a conversation between two users has been created before
        if (!conversationCheckData) {

            //Inserts a conversation into database if there is not a conversation
            const insertConversationResponse = await fetch(`/insert-conversation/${connectionID}`);
            const insertConversationData = await insertConversationResponse.json();

            const conversationID = await getConversationID(connectionID)

            //Inserts a session into database and establishes websocket
            initiateSession(recipientID, conversationID, encryptedAESKey);


        } else {

            const conversationID = await getConversationID(connectionID)
            
            //Updates the conversation timestamp if there is already a conversation in database
            const updateConversationResponse = await fetch(`update-conversation/${conversationID}`)
            const updateConversationData = await updateConversationResponse.json();
            
            //Inserts a session into database and establishes websocket
            initiateSession(recipientID, conversationID, encryptedAESKey)



        }
    } else {
        console.log("Connection not found.");
    }

};

document.getElementById("message-form").addEventListener("submit", async event => {
    event.preventDefault();

    const chatbox = document.getElementById("chatbox-user");
    const messageInput = document.getElementById("message");
    const encryptedContent = messageInput.value;

    const senderID = await getSenderID();
    const recipientID = chatbox.dataset.recipientId;    

    const connectionID = await getConnectionID(recipientID);
    const conversationID = await getConversationID(connectionID);
    const sessionID = await getSessionID(conversationID);


    const dataFormat = "text/short"

    messageInput.value = "";    

    //Emits message to flask server
    sessionSocket.emit('message', sessionID, recipientID, encryptedContent, dataFormat);

    sessionSocket.emit('increment-notification', recipientID)

});

document.getElementById("file-upload").addEventListener("change", async event => {
    event.preventDefault()

    const chatbox = document.getElementById("chatbox-user");
    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];
    const fileName = file.name

    const senderID = await getSenderID();
    const recipientID = chatbox.dataset.recipientId;

    const connectionID = await getConnectionID(recipientID);
    const conversationID = await getConversationID(connectionID);
    const sessionID = await getSessionID(conversationID);

    const IV = "test"
    const dataFormat = file.type;
    const acceptedFormat = ["text/plain", "application/pdf", "image/png", "image/jpeg"]

    const reader = new FileReader();

    reader.onload = (data) => {
        const fileData = data.target.result

        sessionSocket.emit('file', sessionID, recipientID, fileData, fileName, dataFormat, IV);
    }

    if (acceptedFormat.includes(dataFormat)) {
        console.log("Accepted")
        //If file format is an accepted format, emits file to server as an array buffer
        reader.readAsArrayBuffer(file);
    } else {
        console.log("Not accepted")
    }

    sessionSocket.emit('increment-notification', recipientID)

});

document.addEventListener("DOMContentLoaded", async () => {

    //Disconnects user from websocket if they refresh the page or go to a different page
    document.addEventListener("beforeunload", () => {
        if (sessionSocket) {
            sessionSocket.disconnect()
        }
    })

    const senderID = await getSenderID();

    const idResponse = await fetch(`get-RSA-public-key`);
    const RSAPublicKey = await idResponse.json();

    //If RSAPublicKey is null, generate RSA keys
    if (RSAPublicKey == null) {


        encryptionManager.generateRSAKeyPair()
            .then(async (keyPair) =>{
                console.log("Public key:", keyPair.publicKey);
                console.log("Private key:", keyPair.privateKey);

                const insertRSAResponse = await fetch(`/update-RSA-public-key/${keyPair.publicKey}`);
                const insertResponseData = await insertRSAResponse.json();
                console.log(insertResponseData);

                const dbRequest = openDatabase();

                dbRequest.onsuccess = (event) => {
                    const db = event.target.result;
                    saveKey(keyPair.privateKey, senderID, db)
                }

            })


        console.log("No public key")
    } else {
        console.log("Public key")
    }



    const chatList = document.getElementById("chat-list");
    const chatbox = document.getElementById("chatbox-user");
    const introduction = document.getElementById("introduction");

    chatList.addEventListener("click", async event => {

        const clickedUser = event.target.closest(".chat-user");

        const recipientID = clickedUser.dataset.userId;
        chatbox.dataset.recipientId = recipientID;
        
        //Inserts clicked user into conversation and session databases, establishes websocket and resets notifications
        await updateUser(recipientID);
        
        //Updates chat list on left of screen to correct order
        await updateChatList();


        //Resets colour when selecting a different user
        const chatUsers = chatList.querySelectorAll(".chat-user");
        chatUsers.forEach(user => {
            user.style.backgroundColor = "";
        });


        //Sets clicked user to a darker background colour
        clickedUser.style.backgroundColor = "#dde4e4";
    
        //Displays chatbox
        introduction.style.display = "none";
        chatbox.style.display = "block";
 
        //Clears previous chat messages in HTML
        const chatMessages = document.getElementById("chatbox-messages");
        chatMessages.innerHTML = ""

        //Gets list of all chat messages in a data variable via JSON
        const response = await fetch(`/get-chat-messages/${recipientID}`);
        const data = await response.json();

        //decrypt all messages in future
        
        //Loops through all messages and pushes them to HTML, outputting to user's screen
        data.forEach(message => {

            if (message.dataFormat == "text/short") {

                appendMessage(message, senderID, chatMessages)
                
            } else if (message.dataFormat == "text/plain" || message.dataFormat == "application/pdf") {

                appendFile(message, senderID, chatMessages)

            } else if (message.dataFormat == "image/png" || message.dataFormat == "image/jpeg") {
                
                appendImage(message, senderID, chatMessages)

            } else {
                console.log("Invalid file type")
            }
        });
    
    });
    
    document.getElementById("add-user-button").addEventListener("click", () => {
        updateChatList();
    });

    
    updateChatList();

});