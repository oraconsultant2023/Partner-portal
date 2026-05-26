import { json }
from "@remix-run/node";

export async function loader() {

  return json([
    {
      campaign_name:
        "Test Campaign"
    }
  ]);

}