const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const rootDir = path.join(__dirname, '..');
        
        // ค้นหาไฟล์ภาพที่เพิ่ง capture มา (ขึ้นต้นด้วย capture_ และลงท้ายด้วย .png)
        const files = fs.readdirSync(rootDir)
            .filter(f => f.startsWith('capture_') && f.endsWith('.png'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(rootDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time) // เรียงจากใหม่ไปเก่า
            .slice(0, 2) // เอา 2 รูปที่ใหม่ที่สุด
            .map(f => path.join(rootDir, f.name));

        if (files.length === 0) {
            console.error('ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย capture_ ในโฟลเดอร์หลัก');
            return;
        }

        console.log('ไฟล์ที่จะนำมารวมกัน:', files);

        // อ่าน Metadata ของทุกรูปเพื่อคำนวณขนาด
        const imageMetadata = await Promise.all(files.map(f => sharp(f).metadata()));
        
        const maxWidth = Math.max(...imageMetadata.map(m => m.width));
        const totalHeight = imageMetadata.reduce((sum, m) => sum + m.height, 0);

        console.log(`ขนาดรูปใหม่: ${maxWidth}x${totalHeight}`);

        // จัดวางตำแหน่งภาพ (เรียงต่อกันแนวตั้ง)
        let currentY = 0;
        const compositeOptions = files.map((f, index) => {
            const options = {
                input: f,
                top: currentY,
                left: 0
            };
            currentY += imageMetadata[index].height;
            return options;
        });

        const outputPath = path.join(rootDir, 'combined_analysis.png');

        await sharp({
            create: {
                width: maxWidth,
                height: totalHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
        .composite(compositeOptions)
        .toFile(outputPath);

        console.log(`\n✅ รวมภาพสำเร็จ!`);
        console.log(`บันทึกไฟล์เป็น: ${outputPath}`);

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการรวมภาพ:', error);
    }
})();
