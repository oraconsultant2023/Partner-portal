import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await admin.graphql(`
      query {
        metaobjects(type: "partner_resource", first: 50) {
          nodes {
            id
            fields {
              key
              value
              reference {
                ... on MediaImage { image { url } }
                ... on GenericFile { url }
              }
            }
          }
        }
      }
    `);

    const data: any = await response.json();
    if (data.errors) return json({ success: false, error: "GraphQL Query Failed" }, { status: 500 });

    const rawNodes = data.data?.metaobjects?.nodes || [];
    const resources = rawNodes.map((node: any) => {
      const res: any = { id: node.id };
      node.fields.forEach((field: any) => {
        if (field.key === 'thumbnail') res.thumbnailUrl = field.reference?.image?.url || null;
        else if (field.key === 'file') res.fileUrl = field.reference?.url || null;
        else res[field.key] = field.value;
      });
      return res;
    });

    // Return ALL resources. 
    // We will handle filtering in the Partner Dashboard JS later.
    // Return ALL resources. 
    const activeResources = resources.filter((r: any) => r.status === 'Active');

    return json(
      { success: true, resources: activeResources }, 
      { headers: { "Cache-Control": "no-store" } } 
    );

  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}