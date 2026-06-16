import fs from 'fs';

const authPath = 'src/modules/auth/auth.service.ts';
if (fs.existsSync(authPath)) {
    let content = fs.readFileSync(authPath, 'utf8');
    
    // cast activeProvider check
    content = content.replace(/const activeProvider = user\.auth_provider \|\| 'email';/g, "const activeProvider = (user as any).auth_provider || 'email';");
    
    // fix createUser data
    content = content.replace(/user = await this\.authDao\.createUser\(userData\);/g, "user = await this.authDao.createUser(userData as any);");
    
    // cast check
    content = content.replace(/} else if \(user\.auth_provider !== 'google'\) {/g, "} else if ((user as any).auth_provider !== 'google') {");

    fs.writeFileSync(authPath, content);
    console.log('Fixed auth.service.ts');
}

// Remove orphans
const assetsRoutes = 'src/modules/assets/routes/websiteAssets.routes.ts';
if (fs.existsSync(assetsRoutes)) {
    fs.unlinkSync(assetsRoutes);
    console.log('Removed orphaned websiteAssets.routes.ts');
}

console.log('All fixed');
