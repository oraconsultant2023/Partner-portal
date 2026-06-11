import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const data = await request.json();

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

  const input = {
    type: "sponsorship_request",
    fields: [
      { key: "slot_id", value: data.slot_id },
      { key: "slot_title", value: data.slot_title },
      { key: "slot_rate", value: data.slot_rate },
      { key: "slot_placement", value: data.slot_placement },
      { key: "slot_start", value: data.slot_start },
      { key: "slot_end", value: data.slot_end },
      { key: "message", value: data.message },
      { key: "partner_name", value: data.partner_name },
      { key: "partner_email", value: data.partner_email },
      { key: "status", value: "Pending" }
    ]
  };

  const response = await admin.graphql(mutation, { variables: { input } });
  const result = await response.json();

  if (result.data.metaobjectCreate.userErrors.length > 0) {
    return json({ success: false, error: result.data.metaobjectCreate.userErrors[0].message });
  }

  return json({ success: true });
}