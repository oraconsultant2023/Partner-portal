import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await request.json();
    const { slotId, slotTitle, partnerName, partnerEmail, message } = body;

    const fields = [
      { key: "slot_id", value: slotId },
      { key: "slot_title", value: slotTitle },
      { key: "partner_name", value: partnerName },
      { key: "partner_email", value: partnerEmail },
      // FIXED: Sent as a simple string to match your "One" Choice List
      { key: "status", value: "Pending" }, 
      { key: "message", value: message }
    ];

    const metaobjectRes = await admin.graphql(
      `mutation CreateSponsorshipRequest($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metaobject: {
            type: "sponsorship_request",
            capabilities: { publishable: { status: "ACTIVE" } },
            fields: fields,
          },
        },
      }
    );

    const metaobjectData = await metaobjectRes.json();
    const errors = metaobjectData.data?.metaobjectCreate?.userErrors || [];

    if (errors.length > 0) {
      return json({ success: false, error: errors[0].message }, { status: 400 });
    }

    return json({ success: true, message: "Request created!" });
  } catch (error: any) {
    console.error("SUBMIT REQUEST ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}