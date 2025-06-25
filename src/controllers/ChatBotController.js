require('dotenv').config();
const Post = require('../models/PostModel');
const getSuggestions = async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: "Thiếu query yêu cầu" });
    }

    const lowerMsg = query.toLowerCase();

    // Xử lý xã giao
    if (["cảm ơn", "thank", "thanks"].some(word => lowerMsg.includes(word))) {
        return res.json({ reply: "Không có gì, rất vui được giúp bạn!" });
    }

    if (["chào", "hi", "hello", "xin chào"].some(word => lowerMsg.includes(word))) {
        return res.json({ reply: "Chào bạn! Bạn đang cần tìm sản phẩm gì ạ?" });
    }

    try {
        const posts = await Post.find({ "moderation.status": "approved", status: "active" });

        if (posts.length === 0) {
            return res.json({ reply: "Xin lỗi, tôi chưa tìm thấy bài đăng phù hợp với yêu cầu của bạn." });
        }

        const postList = posts.map(p => (
            `- ${p.title}, giá: ${p.price}₫, tình trạng: ${p.attributes?.condition || "Không rõ"}, mô tả: ${p.description}`
        )).join('\n');

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

        const prompt = `
Danh sách bài đăng hiện có:
${postList}

Khách hàng hỏi: "${query}"

Dựa trên danh sách, hãy đưa ra phản hồi phù hợp. Nếu không phù hợp, hãy nói rõ không có bài đăng phù hợp.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, tôi chưa có câu trả lời phù hợp.";

        return res.json({ reply: text || "Xin lỗi, tôi chưa có câu trả lời phù hợp." });
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        res.status(500).json({ error: "Lỗi khi gọi AI" });
    }
};


const uploadImage = async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;

        // Phân tích hình ảnh bằng Gemini
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

        const visionResult = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{
                role: "user",
                parts: [
                    { text: "Mô tả nội dung ảnh này, đặc biệt tập trung vào sản phẩm, màu sắc và kiểu dáng:" },
                    { inlineData: { mimeType: req.file.mimetype, data: imageBuffer.toString("base64") } }
                ]
            }]
        });

        const imageDescription = visionResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Lấy danh sách sản phẩm từ DB
        const posts = await Post.find({ "moderation.status": "approved", status: "active" });

        if (!posts.length) return res.json({ reply: "Hiện chưa có bài đăng để gợi ý." });

        const postList = posts.map(p =>
            `- ${p.title}, tình trạng: ${p.attributes?.condition || "Không rõ"}, mô tả: ${p.description}`
        ).join('\n');

        const matchPrompt = `
Dưới đây là danh sách sản phẩm:
${postList}

Mô tả sản phẩm từ hình ảnh khách gửi: "${imageDescription}"

Hãy gợi ý sản phẩm phù hợp nhất. Nếu không có sản phẩm nào phù hợp, hãy nói rõ.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: matchPrompt }] }]
        });

        const suggestion = result.candidates?.[0]?.content?.parts?.[0]?.text || "Không tìm thấy sản phẩm phù hợp.";

        res.json({ reply: suggestion });
    } catch (err) {
        console.error("Error processing image:", err);
        res.status(500).json({ error: "Lỗi khi xử lý ảnh và tìm sản phẩm." });
    }
};
module.exports = {
    getSuggestions,
    uploadImage
};
