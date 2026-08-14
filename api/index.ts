import express from "express";
import ttsRouter from "../src/server/routers/tts";
import chatRouter from "../src/server/routers/chat";
import documentsRouter from "../src/server/routers/documents";
import synthesisRouter from "../src/server/routers/synthesis";
import reportFollowupRouter from "../src/server/routers/reportFollowup";
import glossaryRouter from "../src/server/routers/glossary";
import glossarySweepRouter from "../src/server/routers/glossarySweep";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(ttsRouter);
app.use(chatRouter);
app.use(documentsRouter);
app.use(synthesisRouter);
app.use(reportFollowupRouter);
app.use(glossaryRouter);
app.use(glossarySweepRouter);

export default app;
