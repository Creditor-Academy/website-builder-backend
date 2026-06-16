import fs from 'fs';

// Fix template.controller.ts
const controllerPath = 'src/modules/template/template.controller.ts';
if (fs.existsSync(controllerPath)) {
    let content = fs.readFileSync(controllerPath, 'utf8');
    content = content.replace(/const \{ id \} = req\.params;/g, 'const id = req.params.id as string;');
    fs.writeFileSync(controllerPath, content);
    console.log('Fixed template.controller.ts');
}

// Fix template.validation.ts
const validationPath = 'src/modules/template/template.validation.ts';
if (fs.existsSync(validationPath)) {
    let content = fs.readFileSync(validationPath, 'utf8');
    content = content.replace(/z\.record\(z\.any\(\)\)/g, 'z.record(z.string(), z.any())');
    fs.writeFileSync(validationPath, content);
    console.log('Fixed template.validation.ts');
}

console.log('Done');
