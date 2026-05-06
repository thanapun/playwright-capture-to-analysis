const fs = require('fs');

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
    return data.access_token;
}

async function testImageNotify() {
    try {
        const token = await getToken();
        // ใช้รูปเดิมที่เคยรวมไว้ (ถ้ามี) หรือรูปชั่วคราว
        const imagePath = './combined_analysis.png';
        if (!fs.existsSync(imagePath)) {
            console.log("ไม่มีไฟล์ combined_analysis.png ให้ทดสอบ");
            return;
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const payload = {
            body: {
                contentType: "html",
                content: `<b>🔔 ทดสอบส่งรูปภาพ</b><br><br><img src="../hostedContents/1"/><br><br>นี่คือการทดสอบส่งรูปภาพผ่าน Graph API`
            },
            hostedContents: [
                {
                    "@odata.type": "#microsoft.graph.chatMessageHostedContent",
                    "contentBytes": base64Image,
                    "contentType": "image/png",
                    "temporaryId": "1"
                }
            ]
        };

        const res = await fetch(`https://graph.microsoft.com/beta/chats/${MS_CONFIG.chatId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("❌ Error:", data.error?.message);
        } else {
            console.log("✅ Success! Message sent with image.");
        }
    } catch (e) {
        console.error("❌ Catch Error:", e.message);
    }
}

testImageNotify();
