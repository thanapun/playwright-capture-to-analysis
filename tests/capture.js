const puppeteer = require('puppeteer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

(async () => {
    // --- ตั้งค่า Gemini ---
    const API_KEY = "xxxx";
    const MODEL_NAME = "models/gemini-3.1-flash-lite-preview";
    const genAI = new GoogleGenerativeAI(API_KEY);

    // --- ตั้งค่า Microsoft Teams (Graph API) ---
    const MS_CONFIG = {
        tenantId: "xxxx",
        clientId: "xxxx",
        clientSecret: "xxxx",
        username: "xxxx",
        password: "xxxx",
        chatId: "xxxx"
    };

    async function getToken() {
        const res = await fetch(`https://login.microsoftonline.com/${MS_CONFIG.tenantId}/oauth2/v2.0/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: MS_CONFIG.clientId,
                client_secret: MS_CONFIG.clientSecret,
                scope: "https://graph.microsoft.com/.default",
                grant_type: "password",
                username: MS_CONFIG.username,
                password: MS_CONFIG.password
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Auth Error: ${data.error_description || data.error}`);
        return data.access_token;
    }

    async function uploadToOneDrive(token, imagePath) {
        const timestamp = Date.now();
        const fileName = `analysis_${timestamp}.png`;
        const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;

        const imageBuffer = fs.readFileSync(imagePath);
        const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "image/png"
            },
            body: imageBuffer
        });

        const data = await res.json();
        if (!res.ok) throw new Error(`OneDrive Upload Error: ${data.error?.message || res.statusText}`);

        // ดึงข้อมูลไฟล์อีกครั้งเพื่อเอา @microsoft.graph.downloadUrl (ลิงก์ตรงสำหรับแสดงผลรูป)
        const fileRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${data.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const fileData = await fileRes.json();
        const downloadUrl = fileData["@microsoft.graph.downloadUrl"];

        // สร้าง Sharing Link (สำหรับให้คนอื่นกดเข้าไปดูใน OneDrive ได้ด้วย)
        const createLinkUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${data.id}/createLink`;
        const linkRes = await fetch(createLinkUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ type: "view", scope: "organization" })
        });
        const linkData = await linkRes.json();

        return {
            id: data.id,
            name: fileName,
            webUrl: linkData.link.webUrl,
            downloadUrl: downloadUrl // ลิงก์ตรงสำหรับ Tag <img>
        };
    }

    async function sendToTeams(text, imagePath) {
        try {
            const token = await getToken();

            console.log('กำลังอัปโหลดรูปภาพไปที่ OneDrive...');
            const fileInfo = await uploadToOneDrive(token, imagePath);
            console.log('✅ อัปโหลดรูปภาพเรียบร้อย');

            const attachmentId = "analysis_img_1";
            const payload = {
                body: {
                    contentType: "html",
                    content: `
                        <b>🔔 รายงานสรุปจาก Gemini (ชัดพิเศษ)</b><br><br>
                        <img src="${fileInfo.downloadUrl}" alt="Analysis Screenshot" width="100%"/><br>
                        <a href="${fileInfo.webUrl}">🔗 คลิกที่นี่เพื่อเปิดดูรูปขนาดเต็มบน OneDrive</a><br><br>
                        ${text.replace(/\n/g, '<br>')}
                        <attachment id="${attachmentId}"></attachment>
                    `
                },
                attachments: [
                    {
                        id: attachmentId,
                        contentType: "reference",
                        contentUrl: fileInfo.webUrl,
                        name: fileInfo.name
                    }
                ]
            };

            const res = await fetch(`https://graph.microsoft.com/v1.0/chats/${MS_CONFIG.chatId}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || res.statusText);
            }
            console.log('✅ ส่งข้อมูลพร้อมไฟล์แนบจาก OneDrive เรียบร้อย!');
        } catch (error) {
            console.error('❌ ไม่สามารถส่งข้อมูลไปยัง Teams ได้:', error.message);
        }
    }

    // 1. เปิด Browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const targets = [
        { name: 'ImportSoybean', url: 'xxxxx' },
        { name: 'CostOfMNF', url: 'xxxx' },
        { name: 'Logistic', url: 'xxx' }
    ];

    const capturedFiles = [];

    try {
        // 2. Login Tableau
        console.log(`กำลังเข้าสู่ระบบ Tableau...`);
        await page.goto(targets[0].url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('input[type="password"]');
        await page.type('input.fv3zcyb:nth-of-type(1)', 'xxxxx');
        await page.type('input[type="password"]', 'xxxx');
        await Promise.all([
            page.click('button[class*="login-page_submit-button"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => { }),
        ]);

        // 3. Capture
        for (const target of targets) {
            console.log(`\n--- กำลังประมวลผล: ${target.name} ---`);
            if (page.url() !== target.url) {
                await page.goto(target.url, { waitUntil: 'networkidle2' });
            }
            await new Promise(r => setTimeout(r, 15000));
            const fileName = `temp_${target.name}.png`;
            const filePath = path.join(__dirname, '..', fileName);
            await page.screenshot({ path: filePath, fullPage: true });
            capturedFiles.push(filePath);
            console.log(`Capture สำเร็จ: ${fileName}`);
        }

        // 4. รวมภาพ
        console.log('\n--- กำลังรวมภาพ ---');
        const imageMetadata = await Promise.all(capturedFiles.map(f => sharp(f).metadata()));
        const maxWidth = Math.max(...imageMetadata.map(m => m.width));
        const totalHeight = imageMetadata.reduce((sum, m) => sum + m.height, 0);
        let currentY = 0;
        const compositeOptions = capturedFiles.map((f, index) => {
            const options = { input: f, top: currentY, left: 0 };
            currentY += imageMetadata[index].height;
            return options;
        });
        const finalOutput = path.join(__dirname, '..', 'combined_analysis.png');
        await sharp({
            create: { width: maxWidth, height: totalHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        }).composite(compositeOptions).toFile(finalOutput);

        // 5. วิเคราะห์ด้วย Gemini
        console.log('\n--- กำลังส่งให้ Gemini วิเคราะห์ ---');
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const prompt = `วิเคราะห์ dashboard ทั้ง 3 ต่อไปนี้: (ตามหัวข้อที่กำหนด)...`;

        const imageBuffer = fs.readFileSync(finalOutput);
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/png" } },
        ]);

        const analysisText = result.response.text();
        console.log("================ ผลการวิเคราะห์ ================");
        console.log(analysisText);

        // 6. ส่งเข้า Teams พร้อมรูปภาพ
        console.log('\n--- กำลังส่งข้อมูลพร้อมรูปภาพเข้า Microsoft Teams ---');
        await sendToTeams(analysisText, finalOutput);

        // ลบไฟล์ชั่วคราว
        capturedFiles.forEach(f => fs.unlinkSync(f));

    } catch (error) {
        console.error('เกิดข้อผิดพลาด:', error);
    } finally {
        await browser.close();
    }
})();
