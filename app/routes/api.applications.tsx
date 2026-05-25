import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      metaobjects(type: "brand_application", first: 50) {
        edges {
          node {
            id
            handle

            capabilities {
              publishable {
                status
              }
            }

            fields {
              key
              value
            }
          }
        }
      }
    }
  `);

  const result = await response.json();

  console.log(
    "APPLICATIONS:",
    JSON.stringify(result, null, 2)
  );

  const applications = result.data.metaobjects.edges.map((edge: any) => {

  const fields: any = {};

  edge.node.fields.forEach((field: any) => {
    fields[field.key] = field.value;
  });

  return {
    id: edge.node.id,
    handle: edge.node.handle,

    publish_status:
edge.node.capabilities?.publishable?.status || "ACTIVE",

    brand_name: fields.brand_name || "",
    website: fields.website || "",
    contact_name: fields.contact_name || "",
    email: fields.email || "",
    category: fields.category || "",
    placements: fields.placements || "",
    affiliate_program: fields.affiliate_program || "",
    status: fields.status || "pending"
  };

});

return json(applications);

}