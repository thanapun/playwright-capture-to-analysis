const { GoogleGenerativeAI } = require("@google/generative-ai");
const API_KEY = "xxxx";
const genAI = new GoogleGenerativeAI(API_KEY);

(async () => {
    const testModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];

    for (const m of testModels) {
        try {
            console.log(`กำลังทดสอบรุ่น: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`✅ รุ่น ${m} ใช้งานได้!`);
            process.exit(0);
        } catch (e) {
            console.log(`❌ รุ่น ${m} ใช้ไม่ได้: ${e.message}`);
        }
    }
})();
