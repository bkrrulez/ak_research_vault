import os
import json
from openai import OpenAI

# Usage Instructions:
# 1. Install dependencies: pip install openai
# 2. Set your NVIDIA_API_KEY environment variable
# 3. Modify the model and messages as needed

def get_semantic_map(items, query):
    client = OpenAI(
      base_url = "https://integrate.api.nvidia.com/v1",
      api_key = os.environ.get("NVIDIA_API_KEY", "$NVIDIA_API_KEY")
    )

    # Prepare context from items
    text_to_analyze = "\n\n---\n\n".join([
        f"Title: {item.get('title', '')}\nContent: {item.get('snippet', '')}" 
        for item in items
    ])

    print(f"Analyzing {len(items)} items for query: '{query}'...")

    completion = client.chat.completions.create(
      model="minimaxai/minimax-m2.7", # Or your preferred model
      messages=[
          {
              "role": "system", 
              "content": f"You are a Semantic Intelligence Engine. Analyze news related to '{query}'. Extract nodes (entities) and edges (relations). Output JSON only."
          },
          {
              "role": "user", 
              "content": text_to_analyze
          }
      ],
      temperature=0.1,
      top_p=0.7,
      max_tokens=2048,
      stream=False # Set to True if you want to handle chunks
    )

    content = completion.choices[0].message.content
    
    # Try to parse JSON from response
    try:
        # Simple extraction if model wraps in markdown
        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[-1].split("```")[0].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return content

if __name__ == "__main__":
    # Example items
    sample_items = [
        {"title": "OpenAI announces GPT-5", "snippet": "A new frontier in AI intelligence."},
        {"title": "Microsoft integrates new AI", "snippet": "Azure services to get massive boost."}
    ]
    
    result = get_semantic_map(sample_items, "AI Progress")
    print(json.dumps(result, indent=2))
