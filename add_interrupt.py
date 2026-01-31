import re

with open('/home/ubuntu/dracin-backend/server.js', 'r') as f:
    content = f.read()

# Find the for loop and add interrupt check
old_loop = 'for (let i = 0; i < videos.length; i++) {'
new_loop = '''for (let i = 0; i < videos.length; i++) {
            // Check for interrupt - stop if priority queue has items
            if (shouldInterrupt && priorityQueue.length > 0) {
                console.log('[INTERRUPT] Stopping drama ' + dramaId + ' for priority...');
                shouldInterrupt = false;
                return 'interrupted';
            }'''

if old_loop in content:
    content = content.replace(old_loop, new_loop, 1)
    with open('/home/ubuntu/dracin-backend/server.js', 'w') as f:
        f.write(content)
    print('Interrupt check added')
else:
    print('Loop pattern not found or already modified')
