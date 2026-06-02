import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch the 50 most recent campaigns from Shopify
    const response = await admin.graphql(
      `query {
        metaobjects(type: "partner_campaign", first: 50, reverse: true) {
          edges {
            node {
              id
              fields {
                key
                value
              }
            }
          }
        }
      }`
    );
    
    const data = await response.json();
    
    if (data.data?.metaobjects?.edges) {
      const campaigns = data.data.metaobjects.edges.map((edge: any) => {
        const fields = edge.node.fields;
        const getField = (key: string) => fields.find((f: any) => f.key === key)?.value || "-";
        
        return {
          id: edge.node.id,
          campaign_name: getField("campaign_name"),
          status: getField("status"),
          start_date: getField("start_date"),
          end_date: getField("end_date")
        };
      });

      return json(campaigns);
    }

    return json([]);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}