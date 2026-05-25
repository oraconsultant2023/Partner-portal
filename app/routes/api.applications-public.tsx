import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  // SECRET CHECK
  const key =
    request.headers.get(
      "x-admin-secret"
    );

  if (
    key !== process.env.ADMIN_API_SECRET
  ) {

    return json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  // SHOPIFY AUTH
  const { admin } =
    await authenticate.admin(request);

  // GRAPHQL QUERY
  const response = await admin.graphql(`
    query {

      metaobjects(
        type: "brand_application",
        first: 50
      ) {

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

  const applications =
    result.data.metaobjects.edges.map(
      (edge: any) => {

        const fields: any = {};

        edge.node.fields.forEach(
          (field: any) => {
            fields[field.key] = field.value;
          }
        );

        return {

          id: edge.node.id,

          brand_name:
            fields.brand_name || "",

          email:
            fields.email || "",

          category:
            fields.category || "",

          publish_status:
            edge.node.capabilities?.publishable?.status ||
            "ACTIVE"

        };

      }
    );

  return json(applications);

}