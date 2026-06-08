import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await request.json();

  const response = await admin.graphql(`
    mutation UpdateResourceStatus($id: ID!, $fields: [MetaobjectFieldInput!]!) {
      metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
        metaobject { id }
        userErrors { message }
      }
    }
  `, {
    variables: {
      id: id,
      fields: [{ key: "status", value: status }]
    }
  });

  const data: any = await response.json();
  if (data.data?.metaobjectUpdate?.userErrors?.length > 0) {
    return json({ success: false, error: data.data.metaobjectUpdate.userErrors[0].message });
  }

  return json({ success: true });
}