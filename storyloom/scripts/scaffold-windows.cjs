// Materialize Microsoft's pinned template without invoking its Windows-only CLI.
// This bootstrap refuses to overwrite an already-created host.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mustache = require('mustache');
async function main() {
  const root = path.resolve(__dirname, '..');
  if (await fs.stat(path.join(root, 'windows')).catch(() => null)) throw new Error('windows/ already exists; bootstrap will not overwrite it.');
  const source = path.join(root, 'node_modules/react-native-windows/templates/cpp-app');
  const projectGuid = crypto.randomUUID(), packageGuid = crypto.randomUUID();
  const values = {name:'Storyloom',namespace:'Storyloom',namespaceCpp:'Storyloom',mainComponentName:'Storyloom',rnwVersion:'0.81.35',rnwPathFromProjectRoot:'node_modules\\react-native-windows',projectGuidLower:`{${projectGuid}}`,projectGuidUpper:`{${projectGuid.toUpperCase()}}`,packageGuidLower:`{${packageGuid}}`,packageGuidUpper:`{${packageGuid.toUpperCase()}}`,currentUser:'Storyloom',devMode:false,useNuGets:true,addReactNativePublicAdoFeed:true,cppNugetPackages:[],autolinkCppPackageProviders:'\n    UNREFERENCED_PARAMETER(packageProviders);'};
  for(const file of await fs.readdir(source,{recursive:true,withFileTypes:true})) {
    if(!file.isFile())continue;
    const from=path.join(file.parentPath,file.name), relative=path.relative(source,from);
    if(!relative.startsWith('windows/') && relative!=='NuGet_Config')continue;
    const target=path.join(root,relative.replaceAll('MyApp','Storyloom').replace('_gitignore','.gitignore').replace('NuGet_Config','NuGet.config'));
    await fs.mkdir(path.dirname(target),{recursive:true}); const bytes=await fs.readFile(from);
    await fs.writeFile(target,/\.(png|ico)$/.test(target)?bytes:mustache.render(bytes.toString(),values));
  }
  console.log('Windows native host generated from react-native-windows 0.81.35.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
