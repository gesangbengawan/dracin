import re

with open('/home/ubuntu/dracin-backend/server.js', 'r') as f:
    content = f.read()

# Pattern to replace: buffer download -> parallel file download
pattern = r'const buffer = await tg\.downloadMedia\(msgs\[0\], \{\}\);\s*fs\.writeFileSync\(rawPath, buffer\);\s*const rawSize = buffer\.length / \(1024 \* 1024\);'

replacement = '''// Optimized Parallel Download
                await tg.downloadMedia(msgs[0], { outputFile: rawPath, workers: 16 });
                const rawSize = fs.statSync(rawPath).size / (1024 * 1024);'''

if 'const buffer = await tg.downloadMedia' in content:
    # Use simple string replacement if regex is tricky with special chars
    new_content = content.replace(
        'const buffer = await tg.downloadMedia(msgs[0], {});',
        'await tg.downloadMedia(msgs[0], { outputFile: rawPath, workers: 16 });'
    ).replace(
        'fs.writeFileSync(rawPath, buffer);',
        '// fs.writeFileSync handled by downloadMedia'
    ).replace(
        'const rawSize = buffer.length / (1024 * 1024);',
        'const rawSize = fs.statSync(rawPath).size / (1024 * 1024);'
    )
    
    with open('/home/ubuntu/dracin-backend/server.js', 'w') as f:
        f.write(new_content)
    print('Optimized download speed (workers: 16)')
else:
    print('Download pattern not found or already optimized')
