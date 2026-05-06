const TENANT_ID = "xxxx";
const CLIENT_ID = "xxxx";

async function getToken() {
    const res = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: "xxxx",
                scope: "https://graph.microsoft.com/.default",
                grant_type: "password",
                username: "xxxx",
                password: "xxxx"
            })
        }
    );
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Auth Error: ${data.error_description || data.error || res.statusText}`);
    }
    return data.access_token;
}

async function runTest() {
    try {
        console.log("กำลังขอ Access Token...");
        const token = await getToken();
        console.log("✅ ได้รับ Token แล้ว");

        console.log("กำลังส่งข้อความ...");
        const result = await sendMessage(token);
        console.log("✅ ส่งข้อความสำเร็จ!");
        console.log("Response:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาด:", error.message);
    }
}

// ปรับปรุงฟังก์ชัน sendMessage ให้รับ token มาเลย
async function sendMessage(token) {
    const res = await fetch(
        "https://graph.microsoft.com/v1.0/chats/19:86d9ba90c4d9433c98a68de7b58733f9@thread.v2/messages",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                body: {
                    contentType: "html",
                    content: "<b>🔔 แจ้งเตือนจากระบบ</b><br>มีข้อมูลใหม่เข้ามา"
                }
            })
        }
    );

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Graph API Error: ${data.error?.message || res.statusText}`);
    }
    return data;
}

runTest();