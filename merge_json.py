import json

# Load existing dramas.json
with open('/home/ubuntu/dracin-backend/dramas.json', 'r') as f:
    existing = json.load(f)

# Load new dramas
with open('/home/ubuntu/dracin-backend/final_progress2.json', 'r') as f:
    new_data = json.load(f)

# Merge dramas - use dict to avoid duplicates
all_dramas = {}
for d in existing['dramas_done']:
    all_dramas[d['id']] = d
for d in new_data['dramas_done']:
    all_dramas[d['id']] = d

# Convert back to list and sort by ID descending (highest first)
merged = sorted(all_dramas.values(), key=lambda x: int(x['id']), reverse=True)

# Update the JSON
existing['dramas_done'] = merged
existing['total_videos'] = sum(d['episodes'] for d in merged)

# Save
with open('/home/ubuntu/dracin-backend/dramas.json', 'w') as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)

print(f"Merged! Total: {len(merged)} dramas")
print(f"Highest ID: {merged[0]['id']} - {merged[0]['title']}")
print(f"Lowest ID: {merged[-1]['id']} - {merged[-1]['title']}")
