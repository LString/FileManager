const bwipjs = require('bwip-js');
const { Document, Packer, ImageRun, Paragraph ,AlignmentType } = require('docx');
const fs = require('fs').promises;

// PDF417 条码生成器
async function generatePDF417(text, options = {}) {
    const { scale = 3, height = 15 } = options;

    try {
        return await bwipjs.toBuffer({
            bcid: 'pdf417',
            text: text,
            scale: scale,
            height: height,
            columns: 6,
            security: 2,
            includetext: true
        });
    } catch (err) {
        throw new Error(`PDF417生成失败: ${err.message}`);
    }
}

// Word 文档生成器
async function createWordDoc(outputPath, data) {
    // 参数验证
    if (!data?.barcode || !(data.barcode instanceof Buffer)) {
        throw new Error('无效的条码图片数据');
    }

    try {
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        width: 11906,   // A4 21cm in twip
                        height: 16838,  // A4 29.7cm in twip
                        orientation: 'portrait'
                    }
                },
                children: [
                    new Paragraph({
                        text: data.title || "PDF417 条码文档",
                        style: "BarcodeTitle",
                    }),
                    new Paragraph({
                        text: `生成时间: ${new Date().toLocaleString()}`,
                        spacing: { after: 400 },
                        alignment: AlignmentType.RIGHT
                    }),
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: data.barcode,
                                type: "png",
                                transformation: {
                                    width: 300,  // 使用较小的尺寸
                                    height: 75,
                                    flipVertical: false, // 明确关闭不必要的变换
                                    flipHorizontal: false,
                                },
                            })
                        ],
                        alignment:AlignmentType.CENTER
                    })
                ]
            }]
        });

        const buffer = await Packer.toBuffer(doc);

        // 文件头验证
        if (!buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]))) {
            throw new Error('生成文件头校验失败');
        }

        await fs.writeFile(outputPath, buffer);
        return outputPath;
    } catch (err) {
        throw new Error(`Word文档创建失败: ${err.message}`);
    }
}

// 集成导出方法
async function generateAndExport(options) {
    // 参数验证
    const requiredParams = ['text', 'outputPath'];
    requiredParams.forEach(param => {
        if (!options?.[param]) {
            throw new Error(`缺少必要参数: ${param}`);
        }
    });

    try {
        // 生成条码
        const barcodeBuffer = await generatePDF417(options.text, {
            scale: options.scale || 3,
            height: options.barcodeHeight || 15
        });

        // 调试图片
        // await fs.writeFile('debug-barcode.png', barcodeBuffer);

        // 格式化路径
        const normalizedPath = options.outputPath.endsWith('.docx')
            ? options.outputPath
            : `${options.outputPath}.docx`;

        // 创建Word文档
        return await createWordDoc(normalizedPath, {
            title: options.title || "默认标题",
            barcode: barcodeBuffer,
            imageWidth: options.imageWidth || 400,
            imageHeight: options.imageHeight || 200,
            additionalText: options.additionalText
        });
    } catch (err) {
        throw new Error(`文档导出失败: ${err.message}`);
    }
}

module.exports = { generateAndExport };