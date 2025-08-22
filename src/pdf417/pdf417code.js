// const fs = require('fs');
// const path = require('path');
// const PDF417 = require('pdf417-generator');
// const encode = PDF417.encode; // 保留原逻辑
// const { createCanvas } = require('canvas');
// const Docxtemplater = require('docxtemplater');
// const PizZip = require('pizzip');

// // PDF417生成函数（返回图片Buffer）
// function generatePDF417(data, options = {}) {
//     try {
//         const defaultOpts = {
//             columns: 6,
//             securityLevel: 2,
//             moduleWidth: 2,
//             moduleHeight: 8
//         };
//         const mergedOpts = { ...defaultOpts, ...options };

//         const convertedData = typeof data === 'string' ? data : data.join('\n');


//         const codes = encode(convertedData, {
//             columns: mergedOpts.columns,
//             securityLevel: mergedOpts.securityLevel
//         });

//         const canvas = createCanvas(600, 300);
//         const ctx = canvas.getContext('2d');
        
//         ctx.fillStyle = '#000000';
//         codes.forEach((row, y) => {
//             row.forEach((module, x) => {
//                 if (module === 1) {
//                     ctx.fillRect(
//                         x * mergedOpts.moduleWidth,
//                         y * mergedOpts.moduleHeight,
//                         mergedOpts.moduleWidth,
//                         mergedOpts.moduleHeight
//                     );
//                 }
//             });
//         });

//         return canvas.toBuffer('image/png');
//     } catch (err) {
//         throw new Error(`PDF417生成失败: ${err.message}`);
//     }
// }

// // 创建Word文档（内置模板生成）
// function createWordDoc(outputPath, data, imageBuffer) {
//     try {
//         // 定义核心XML模板
//         const contentTypes = `
// <?xml version="1.0" encoding="UTF-8"?>
// <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
//   <Default Extension="png" ContentType="image/png"/>
//   <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
//   <Default Extension="xml" ContentType="application/xml"/>
//   <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
// </Types>`;

//         const documentXml = `
// <?xml version="1.0" encoding="UTF-8"?>
// <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
//   <w:body>
//     <w:p><w:r><w:t>${data.title || 'PDF417条码文档'}</w:t></w:r></w:p>
//     <w:p><w:r><w:t>生成时间: ${new Date().toLocaleString()}</w:t></w:r></w:p>
//     {@barcodeImage}
//     ${data.additionalText ? `<w:p><w:r><w:t>${data.additionalText}</w:t></w:r></w:p>` : ''}
//   </w:body>
// </w:document>`;

//         const documentRels = `
// <?xml version="1.0" encoding="UTF-8"?>
// <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
//   <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" 
//                 Target="media/barcode.png"/>
// </Relationships>`;

//         const coreProps = `
// <?xml version="1.0" encoding="UTF-8"?>
// <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
//                    xmlns:dc="http://purl.org/dc/elements/1.1/"
//                    xmlns:dcterms="http://purl.org/dc/terms/">
//   <dc:title>${data.title || '动态生成的PDF417文档'}</dc:title>
//   <dc:creator>PDF417生成工具</dc:creator>
//   <cp:keywords>PDF417,动态生成</cp:keywords>
//   <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
// </cp:coreProperties>`;

//         // 构建ZIP包
//         const zip = new PizZip();
//         zip.file("[Content_Types].xml", contentTypes);
//         zip.file("word/document.xml", documentXml);
//         zip.file("word/_rels/document.xml.rels", documentRels);
//         zip.file("docProps/core.xml", coreProps);
//         zip.file("word/media/barcode.png", imageBuffer);

//         // 使用docxtemplater处理
//         const doc = new Docxtemplater(zip, {
//             paragraphLoop: true,
//             linebreaks: true,
//             modules: { 
//                 // 启用图像模块
//                 imagemodule: { 
//                     factory: (token) => {
//                         const image = token.value;
//                         return {
//                             path: `word/media/${image.relationId}.${image.extension}`,
//                             data: Buffer.from(image.data, 'base64'),
//                             width: image.size[0],
//                             height: image.size[1]
//                         };
//                     }
//                 }
//             }
//         });

//         doc.setData({
//             ...data,
//             barcodeImage: {
//                 data: imageBuffer.toString('base64'),
//                 size: [data.imageWidth || 400, data.imageHeight || 200],
//                 extension: 'png',
//                 relationId: 'barcode' // 对应rels中的rId1
//             }
//         });

//         doc.render();
        
//         // 生成最终文档
//         const buffer = doc.getZip().generate({ type: 'nodebuffer' });
//         fs.writeFileSync(outputPath, buffer);
//         return outputPath;
//     } catch (err) {
//         throw new Error(`Word生成失败: ${err.message}`);
//     }
// }

// // 导出模块
// module.exports = {
//     generatePDF417,
//     createWordDoc,
    
//     async generateAndExport(data, outputPath) {
//         try {
//             const imageBuffer = generatePDF417(data.text, data.barcodeOptions);
//             return createWordDoc(outputPath, data, imageBuffer);
//         } catch (err) {
//             throw new Error(`导出失败: ${err.message}`);
//         }
//     }
// };

// // 使用示例
// /* const { generateAndExport } = require('./your-module');
// generateAndExport(
//     {
//         text: "ABC123456789", 
//         title: "测试文档",
//         additionalText: "此文档为自动生成",
//         imageWidth: 500,
//         imageHeight: 250
//     },
//     path.join(__dirname, 'output.docx')
// ); */