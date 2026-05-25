import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query GetApplications {
      metaobjects(type: "brand_application", first: 50) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  const applications = data.data.metaobjects.edges.map((edge: any) => {

    const fields: any = {};

    edge.node.fields.forEach((field: any) => {
      fields[field.key] = field.value;
    });

    return {
      id: edge.node.id,
      handle: edge.node.handle,
      brand_name: fields.brand_name || "",
      email: fields.email || "",
      category: fields.category || "",
      status: fields.status || "pending"
    };

  });

  return json(applications);
}