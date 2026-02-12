import "dotenv/config";

type ResponsesCreateBody = {
    model: string
    input: any
    temperature?: number
    max_output_tokens?: number
};

export async function createResponse(body: ResponsesCreateBody) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY")
    // console.log(JSON.stringify(body))
    const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })

    const text = await res.text()
    let data: any
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (data?.error?.message) {
        const msg = data?.error?.message || `OpenAI error ${res.status}`
        throw new Error(msg)
    }

    return data
}
