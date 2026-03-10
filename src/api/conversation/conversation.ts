import { Router } from "express";
import { z } from "zod";
import { createResponse } from "../helpers/openai";

const router = Router();

const AGENT_A = process.env.AGENT_A ?? 'AGENT_A'

const AGENT_B = process.env.AGENT_B ?? 'AGENT_B'

// Request bodies (match your schemas)
const StartSchema = z.object({  
    message: z.string().min(1)
});

const FeedbackSchema = z.object({   
    feedback: z.boolean()
})

type Message = {
    id: string;
    message: string[];
    name?: string;
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

function instruction(feedback: boolean) {
    return feedback
        ? `Continue the ${AGENT_A}/${AGENT_B} conversation by reinforcing what made it more entertaining.`
        : `Continue the ${AGENT_A}/${AGENT_B} conversation by making it more about crabs.`
}

function transformResponse(openaiResp: Record<string, any>) {
    if (!Array.isArray(openaiResp.output)) {
        throw new Error("Unexpected OpenAI response shape")
    }

    const conversationSets: {id: string, message: string[]}[] = openaiResp.output.map((o: { id: string, content: { text: string }[]}) => {
        const message = o.content.map((c: {text: string}) => c.text)
        return {id: o.id, message }
    })

    const agents: Record<string, Message> = {}

    for (let cs of conversationSets) {
        for (let m of cs.message) {
            const conversationArray = m.split("\n\n")

            for (let agent of [AGENT_A, AGENT_B]) {
                const message = conversationArray.filter((i: string) => i.indexOf(`${agent}:`) >= 0).map(i2 => i2.replace(`${agent}: `,""))

                agents[agent] = {
                    'id': cs.id,
                    'name': agent,
                    message
                }
            }

        }
    }

    return agents;
}

router.post("/start", async (req, res) => { 
    const parsed = StartSchema.safeParse(req.body);  
    if (!parsed.success) return res.status(400).json({ detail: z.treeifyError(parsed.error) });
    
    const { message } = parsed.data;

    try {
        const openaiResp = await createResponse({
            model: process.env.OPENAI_MODEL || "gpt-5.2",
            input: [
                { role: "system", content: systemPrompt() },
                { role: "user", content: `Kick off the conversation about: ${message}` }
            ],
        });
        return res.json({ ...transformResponse(openaiResp) });
    } catch (err: any) {
        return res.status(500).json({ detail: err.message || "Internal server error" });
    }
});

router.post("/message", async (req, res) => {   
    const parsed = FeedbackSchema.safeParse(req.body); 
    if (!parsed.success) return res.status(400).json({ detail: z.treeifyError(parsed.error) });

    const { feedback } = parsed.data;

    try {
        const openaiResp = await createResponse({
            model: process.env.OPENAI_MODEL || "gpt-5.2",
            input: [
                { role: "system", content: systemPrompt() },
                { role: "user", content: instruction(feedback) },
                { role: "user", content: `Meta: feedback=${feedback}` },
            ],
        });
        return res.json({ ...transformResponse(openaiResp) });
    } catch (err: any) {
        return res.status(500).json({ detail: err.message || "Internal server error" });
    }
});

export default router;
