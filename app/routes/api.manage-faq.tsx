import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { authenticate } from "../shopify.server";
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const response = await admin.graphql(
      `
      mutation CreateFaq($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
      `,
      {
        variables: {
          metaobject: {
            type: "partner_faq",
            fields: [
              { key: "question", value: body.question },
              { key: "answer", value: body.answer },
              { key: "category", value: body.category }, // Add this line
            ],
          },
        },
      }
    );

    const data: any = await response.json();
    const errors = data?.data?.metaobjectCreate?.userErrors;

    if (errors?.length) {
      // This will now pass a JSON error back to the frontend
      return json({ success: false, error: errors[0].message }, { status: 422 });
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("FAQ ACTION ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}