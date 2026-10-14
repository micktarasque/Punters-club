import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {defineConfig} from 'vite';

const TINY_INFLATE_RUNTIME = `
function __tsInflate(b64){
  var bin=atob(b64),dLen=bin.length,data=new Uint8Array(dLen);
  for(var z=0;z<dLen;z++)data[z]=bin.charCodeAt(z);
  var pos=0,bitBuf=0,bitCnt=0,buf=new Uint8Array(dLen*4),outLen=0;
  function ensure(need){
    if(outLen+need>buf.length){
      var next=new Uint8Array(Math.max(buf.length*2,outLen+need));
      next.set(buf.subarray(0,outLen));
      buf=next;
    }
  }
  function bits(n){
    while(bitCnt<n){bitBuf|=(data[pos++]||0)<<bitCnt;bitCnt+=8;}
    var v=bitBuf&((1<<n)-1);bitBuf>>>=n;bitCnt-=n;return v;
  }
  function buildTree(lengths){
    var counts=new Int32Array(16),offsets=new Int32Array(16),i;
    for(i=0;i<lengths.length;i++)if(lengths[i])counts[lengths[i]]++;
    var code=0;
    for(i=1;i<=15;i++){offsets[i]=code;code+=counts[i];}
    var syms=new Int32Array(lengths.length);
    for(i=0;i<lengths.length;i++){var l=lengths[i];if(l)syms[offsets[l]++]=i;}
    return{counts:counts,syms:syms};
  }
  function decode(tree){
    var code=0,first=0,idx=0;
    for(var len=1;len<=15;len++){
      code|=bits(1);
      var count=tree.counts[len];
      if(code-count<first)return tree.syms[idx+(code-first)];
      idx+=count;first=(first+count)<<1;code<<=1;
    }
    return 0;
  }
  var fLit=new Uint8Array(288),i;
  for(i=0;i<=143;i++)fLit[i]=8;
  for(i=144;i<=255;i++)fLit[i]=9;
  for(i=256;i<=279;i++)fLit[i]=7;
  for(i=280;i<=287;i++)fLit[i]=8;
  var fDist=new Uint8Array(32);fDist.fill(5);
  var fLitTree=buildTree(fLit),fDistTree=buildTree(fDist);
  var lBase=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var lExt=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var dBase=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var dExt=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var clOrd=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  var bfinal=0;
  while(!bfinal){
    bfinal=bits(1);var btype=bits(2);
    if(btype===0){
      bitBuf=0;bitCnt=0;
      var len=data[pos]|(data[pos+1]<<8);pos+=4;
      ensure(len);buf.set(data.subarray(pos,pos+len),outLen);outLen+=len;pos+=len;
    }else{
      var litTree=fLitTree,distTree=fDistTree;
      if(btype===2){
        var hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4,clLens=new Uint8Array(19);
        for(i=0;i<hclen;i++)clLens[clOrd[i]]=bits(3);
        var clTree=buildTree(clLens),lens=new Uint8Array(hlit+hdist);
        for(i=0;i<hlit+hdist;){
          var sym=decode(clTree);
          if(sym<16)lens[i++]=sym;
          else if(sym===16){var p=lens[i-1],r=bits(2)+3;for(var k=0;k<r;k++)lens[i++]=p;}
          else if(sym===17){var r2=bits(3)+3;for(var k2=0;k2<r2;k2++)lens[i++]=0;}
          else{var r3=bits(7)+11;for(var k3=0;k3<r3;k3++)lens[i++]=0;}
        }
        litTree=buildTree(lens.subarray(0,hlit));
        distTree=buildTree(lens.subarray(hlit));
      }
      while(true){
        var s=decode(litTree);
        if(s<256){ensure(1);buf[outLen++]=s;}
        else if(s===256)break;
        else{
          var li=s-257,length=lBase[li]+bits(lExt[li]),ds=decode(distTree),dist=dBase[ds]+bits(dExt[ds]);
          ensure(length);
          for(var m=0;m<length;m++){buf[outLen]=buf[outLen-dist];outLen++;}
        }
      }
    }
  }
  return new TextDecoder("utf-8").decode(buf.subarray(0,outLen));
}
`.trim();

export default defineConfig(({command}) => {
  const isBuild = command === 'build';
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'suppress-vite-client-ws-when-hmr-disabled',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code
              .replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket disabled */'
              )
              .replace(
                'reject(/* @__PURE__ */ new Error("WebSocket closed without opened."));',
                'resolve();'
              );
          }
          return null;
        },
      },
      {
        name: 'standalone-classic-bundle-for-file-explorer-and-hosting',
        enforce: 'post',
        generateBundle(_options, bundle) {
          for (const file of Object.values(bundle)) {
            if (file.type === 'chunk' && file.isEntry) {
              const cleaned = file.code.replace(
                /\bexport\s*\{[^}]*\}\s*;?\s*$/,
                ''
              );
              file.code = `(function(){\n${cleaned}\n})();\n`;
            }
          }
        },
        transformIndexHtml: {
          order: 'post',
          handler(html, ctx) {
            if (!ctx.bundle) return html;
            return html
              .replace(
                /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g,
                '<script defer src="$1"></script>'
              )
              .replace(
                /<script\s+type="module"\s+src="([^"]+)"><\/script>/g,
                '<script defer src="$1"></script>'
              )
              .replace(
                /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g,
                '<link rel="stylesheet" href="$1">'
              )
              .replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '');
          },
        },
        closeBundle() {
          try {
            const distDir = path.resolve(import.meta.dirname, 'dist');
            const indexJsPath = path.join(distDir, 'assets', 'index.js');
            const indexCssPath = path.join(distDir, 'assets', 'index.css');
            const indexHtmlPath = path.join(distDir, 'index.html');

            if (fs.existsSync(indexJsPath) && fs.existsSync(indexHtmlPath)) {
              const fullJs = fs.readFileSync(indexJsPath, 'utf-8');
              const b64Match = fullJs.match(/([`'"])([A-Za-z0-9+/=]{200000,})\1/);

              let html = fs.readFileSync(indexHtmlPath, 'utf-8');

              if (fs.existsSync(indexCssPath)) {
                const cssContent = fs.readFileSync(indexCssPath, 'utf-8');
                html = html.replace(
                  /<link\s+rel="stylesheet"\s+href="[^"]*index\.css[^"]*">/,
                  `<style>${cssContent}</style>`
                );
              }

              if (b64Match && b64Match[2]) {
                const seedB64 = b64Match[2];
                const dataJsContent = `window.__TURFSHEET_SEED_B64__ = "${seedB64}";\n`;
                let appOnlyRaw = fullJs.replace(
                  b64Match[0],
                  '(window.__TURFSHEET_SEED_B64__ || "")'
                );

                const extractedImgs: string[] = [];
                appOnlyRaw = appOnlyRaw.replace(
                  /(["'`])(data:image\/[^;]+;base64,[A-Za-z0-9+/=]{10000,})\1/g,
                  (_m, _q, uri) => {
                    const idx = extractedImgs.length;
                    extractedImgs.push(uri);
                    return `(window.__TS_IMGS__&&window.__TS_IMGS__[${idx}]||"")`;
                  }
                );

                const imgScriptTag =
                  extractedImgs.length > 0
                    ? `<script>window.__TS_IMGS__=${JSON.stringify(extractedImgs)};</script>\n    `
                    : '';

                const appDeflatedB64 = zlib
                  .deflateRawSync(Buffer.from(appOnlyRaw, 'utf-8'), {level: 9})
                  .toString('base64');
                const appJsSelfExtracting = `(function(){\n${TINY_INFLATE_RUNTIME}\nvar s=document.createElement("script");s.text=__tsInflate("${appDeflatedB64}");(document.head||document.documentElement).appendChild(s);\n})();\n`;

                fs.writeFileSync(
                  path.join(distDir, 'data.js'),
                  dataJsContent,
                  'utf-8'
                );
                fs.writeFileSync(
                  path.join(distDir, 'app.js'),
                  appJsSelfExtracting,
                  'utf-8'
                );
                html = html.replace(
                  /<script\s+defer\s+src="[^"]*index\.js[^"]*"><\/script>/,
                  `${imgScriptTag}<script defer src="./data.js"></script>\n    <script defer src="./app.js"></script>`
                );
              } else {
                const fullDeflatedB64 = zlib
                  .deflateRawSync(Buffer.from(fullJs, 'utf-8'), {level: 9})
                  .toString('base64');
                const appJsSelfExtracting = `(function(){\n${TINY_INFLATE_RUNTIME}\nvar s=document.createElement("script");s.text=__tsInflate("${fullDeflatedB64}");(document.head||document.documentElement).appendChild(s);\n})();\n`;
                fs.writeFileSync(
                  path.join(distDir, 'app.js'),
                  appJsSelfExtracting,
                  'utf-8'
                );
                html = html.replace(
                  /<script\s+defer\s+src="[^"]*index\.js[^"]*"><\/script>/,
                  '<script defer src="./app.js"></script>'
                );
              }

              fs.writeFileSync(indexHtmlPath, html, 'utf-8');

              execFileSync('python3', ['scripts/infinityfree_export_and_deploy.py'], {
                cwd: import.meta.dirname,
                stdio: 'ignore',
              });
            }
          } catch (err) {
            console.error('Post-build flat-root split error:', err);
          }
        },
      },
    ],
    build: {
      assetsInlineLimit: 35000,
      chunkSizeWarningLimit: 5000,
      rolldownOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
    resolve: {
      alias: {
        ...(isBuild
          ? {
              'firebase/app': path.resolve(
                import.meta.dirname,
                'src/firebaseStaticShim.ts'
              ),
              'firebase/auth': path.resolve(
                import.meta.dirname,
                'src/firebaseStaticShim.ts'
              ),
              'firebase/firestore': path.resolve(
                import.meta.dirname,
                'src/firebaseStaticShim.ts'
              ),
            }
          : {}),
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      ws: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
