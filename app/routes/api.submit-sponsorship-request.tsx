import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  // 1. Authenticate the request
 const { session } = await authenticate.public.appProxy(request);
  
  // 2. Parse the JSON from the frontend
  const data = await request.json();

  // 3. Define the GraphQL Mutation
  const mutation = `
    mutation createSponsorshipRequest($input: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $input) {
        metaobject {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // 4. Map payload to your Metaobject Field Keys
  // Ensure these "key" values match exactly what is in your Shopify Admin
  const input = {
    type: "sponsorship_request",
    fields: [
      { key: "slot_id", value: data.slot_id },
      { key: "slot_title", value: data.slot_title },
      { key: "partner_name", value: data.partner_name },
      { key: "partner_email", value: data.partner_email },
      { key: "message", value: data.message },
      { key: "status", value: data.status },
      { key: "slot_rate", value: data.slot_rate },
      { key: "slot_placement", value: data.slot_placement },
      { key: "slot_start", value: data.slot_start },
      { key: "slot_end", value: data.slot_end }
    ]
  };

  try {
    const response = await admin.graphql(mutation, { variables: { input } });
    const result = await response.json();

    // 5. Handle Errors
    if (result.data?.metaobjectCreate?.userErrors?.length > 0) {
      return json({ 
        success: false, 
        error: result.data.metaobjectCreate.userErrors[0].message 
      });
    }

    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}