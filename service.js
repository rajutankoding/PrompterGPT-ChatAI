const express = require("express");
require("dotenv").config();
const { OpenAI } = require("openai");

const app = express();
app.use(express.json()); // Agar express dapat mengambil data dari req.body

const openai = new OpenAI({ apiKey: process.env.API_KEY });
const assistantId = process.env.ASSISTANT_ID;

let pollingInterval;

const createThread = async () => {
  try {
    console.log("Creating a new thread...");
    const thread = await openai.beta.threads.create();
    return thread;
  } catch (error) {
    console.error("Error creating thread:", error);
    throw error;
  }
};

const addMessage = async (threadId, message) => {
  try {
    console.log("Adding a message to the thread...", threadId);
    const response = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });
    return response;
  } catch (error) {
    console.error("Error adding message:", error);
    throw error;
  }
};

const runAssistant = async (threadId) => {
  try {
    console.log("Running the assistant...", threadId);
    const response = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });
    return response;
  } catch (error) {
    console.error("Error running assistant:", error);
    throw error;
  }
};

const checkingStatus = async (res, threadId, runId) => {
  try {
    console.log("Checking the status of the run...", threadId, runId);
    const runObject = await openai.beta.threads.runs.retrieve(threadId, runId);
    const status = runObject.status;
    console.log("Current status:", status);

    if (status === "completed") {
      clearInterval(pollingInterval);
      const messageList = await openai.beta.threads.messages.list(threadId);
      let messages = [];
      messageList.data.forEach((msg) => {
        messages.push(msg.content);
      });
      res.json({ messages });
    }
  } catch (error) {
    console.error("Error checking status:", error);
    res.status(500).json({ error: "Error checking the status of the run." });
  }
};

app.get("/thread", (req, res) => {
  createThread()
    .then((thread) => {
      res.json({ threadId: thread.id });
    })
    .catch((error) => {
      res.status(500).json({ error: "Failed to create a new thread." });
    });
});

app.post("/message", (req, res) => {
  const { message, threadId } = req.body;
  if (!message || !threadId) {
    return res
      .status(400)
      .json({ error: "Message and threadId are required." });
  }

  addMessage(threadId, message)
    .then(() => runAssistant(threadId))
    .then((run) => {
      const runId = run.id;
      pollingInterval = setInterval(() => {
        checkingStatus(res, threadId, runId);
      }, 5000);
    })
    .catch((error) => {
      res.status(500).json({
        error: "An error occurred while processing the message.",
        details: error.message,
      });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
