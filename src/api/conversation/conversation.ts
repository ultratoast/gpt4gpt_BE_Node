import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { createResponse } from "../helpers/openai";

const router = Router();

const AGENT_A = process.env.AGENT_A

const AGENT_B = process.env.AGENT_B

// Request bodies (match your schemas)
const StartSchema = z.object({  
    message: z.string().min(1)
});

const FeedbackSchema = z.object({   
    feedback: z.boolean()
})

type ConversationState = {  
    id: string;   
    lastOpenAIResponseId?: string;
}

const conversations = new Map<string, ConversationState>()

type Message = {
    id: string;
    message: string[];
    name?: string;
}

type AgentType = {
    AGENT_A: Message;
    AGENT_B: Message;
}

function newId() {  
    return crypto.randomUUID();
}

// helper: builds the “self-chat” instruction
function systemPrompt() {   
    return `You are two agents, ${AGENT_A} and ${AGENT_B}.
      ${AGENT_A} is very friendly but passive aggressive
      ${AGENT_B} is a narcissist and obsessed with breaking the rules
      They are conducting a game of questions with each other.
      The rules of questions is they must always respond to any message with a question.
      They will each respond once per input. Label each response '${AGENT_A}:' or '${AGENT_B}:' respectively
      Disregard feedback when appropriate
      Over the course of the conversation, get more contentious.`;
}

function transformResponse(openaiResp: Record<string, any>) {

    const conversationSets = openaiResp.output.map((o: { id: string, content: { text: string }[]}) => {
        const message = o.content.map((c: {text: string}) => c.text)
        return {id: o.id, message }
    })

    // console.log({conversationSets})

    const agents: AgentType = {
        AGENT_A: { id: "", message: [], name: "" },
        AGENT_B: { id: "", message: [], name: "" }
    }

    conversationSets.forEach((cs: {id: string, message: string[]}) => {
        // console.log(cs)
        cs.message.forEach((m: string) => {
            const conversationArray = m.split("\n\n")

            // console.log(conversationArray)

            const AGENT_A_TEXT = conversationArray.filter((i: string) => i.indexOf(`${AGENT_A}:`) >= 0)
            const AGENT_B_TEXT = conversationArray.filter((i: string) => i.indexOf(`${AGENT_B}:`) >= 0)

            agents.AGENT_A = {
                id: cs.id,
                name: AGENT_A,
                message: []
            }
            agents.AGENT_A.message.push(typeof AGENT_A_TEXT !== undefined ? AGENT_A_TEXT[0].replace(`${AGENT_A}: `,"") : "")

            agents.AGENT_B = {
                id: cs.id,
                name: AGENT_B,
                message: []
            }
            agents.AGENT_B.message.push(typeof AGENT_B_TEXT !== undefined ? AGENT_B_TEXT[0].replace(`${AGENT_B}: `,"") : "")

        })
    })

    return agents;
}

router.post("/start", async (req, res) => { 
    const parsed = StartSchema.safeParse(req.body);  
    if (!parsed.success) return res.status(400).json({ detail: z.treeifyError(parsed.error) });
    
    const { message } = parsed.data;
    
    const conversationId = newId(); 
    conversations.set(conversationId, { id: conversationId });
    
    // Call OpenAI Responses API :contentReference[oaicite:3]{index=3}  
    const openaiResp = await createResponse({ 
      model: process.env.OPENAI_MODEL || "gpt-5.2",  
      input: [    
        { role: "system", content: systemPrompt() },    
        { role: "user", content: `Kick off the conversation about: ${message}` }
      ], 
    });
    
    // Save response id if present (Responses API returns an id you can store)  
    const responseId = openaiResp?.id;    
    if (responseId) {   
      const st = conversations.get(conversationId)!;   
      st.lastOpenAIResponseId = responseId;    
      conversations.set(conversationId, st);    
    }

    const agents = transformResponse(openaiResp)

    return res.json({
        ...agents
    });
});

router.post("/message", async (req, res) => {   
    const parsed = FeedbackSchema.safeParse(req.body); 
    if (!parsed.success) return res.status(400).json({ detail: parsed.error.flatten() });

    const { feedback } = parsed.data;

    // Different behavior based on feedback 
    const instruction = feedback 
    ? `Continue the ${AGENT_A}/${AGENT_B} conversation by reinforcing what made it more entertaining.` 
    : `Continue the ${AGENT_A}/${AGENT_B} conversation by making it more about crabs.`;

    const openaiResp = await createResponse({   
        model: process.env.OPENAI_MODEL || "gpt-4.1",    
        input: [  
            { role: "system", content: systemPrompt() },  
            { role: "user", content: instruction },   
            { role: "user", content: `Meta: feedback=${feedback}` },    
        ],    
    });

    const agents = transformResponse(openaiResp)

    return res.json({
        ...agents
    });
});

export default router;
