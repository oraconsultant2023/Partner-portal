import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // 1. Parse the placements back into an array so Shopify's "List" field accepts it
    const placementsArray = JSON.parse(body.placementType); 
    
    // 2. The rate is already a stringified JSON array from the frontend, 
    // we save it directly into the new Multi-line text field
    const ratesString = body.rate; 

    // Build the fields array dynamically
    const metaobjectFields: any[] = [
      { key: "title", value: body.title },
      { key: "description", value: body.description },
      { key: "specs", value: body.specs },
      // Shopify "List" fields expect the value to be a stringified array
      { key: "placement_type", value: JSON.stringify(placementsArray) },
      { key: "inventory_status", value: JSON.stringify([body.status]) }, 
      { key: "rate", value: ratesString } 
    ];

    // Optional: Handle the thumbnail file if you are uploading it to Shopify Files API here
    // (Assuming you have existing logic for fileData/fileName, append it to metaobjectFields)

    // 3. Send the Mutation to Shopify
    const response = await admin.graphql(`
      mutation CreateSponsorshipSlot($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "sponsorship_slot",
          fields: metaobjectFields
        }
      }
    });

    const data: any = await response.json();
    const errors = data?.data?.metaobjectCreate?.userErrors;

    if (errors?.length > 0) {
      return json({ success: false, error: errors[0].message });
    }

    return json({ success: true });

  } catch (error: any) {
    console.error("Create Slot Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}