import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { id, notes } = await request.json();

    if (!id) {
      return json({ success: false, error: "Missing application ID" }, { status: 400 });
    }

    const response = await admin.graphql(
      `mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: id,
          metaobject: {
            fields: [
              { key: "internal_notes", value: notes }
            ]
          }
        }
      }
    );

    const data = await response.json();
    const errors = data.data?.metaobjectUpdate?.userErrors || [];

    if (errors.length > 0) {
      return json({ success: false, error: errors[0].message }, { status: 400 });
    }

    return json({ success: true, message: "Notes updated successfully" });

  } catch (error: any) {
    console.error("UPDATE NOTES ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}