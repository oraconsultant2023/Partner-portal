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

    const response = await admin.graphql(`
      mutation CreateFaq($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "partner_faq",
          fields: [
            { key: "question", value: body.question },
            { key: "answer", value: body.answer },
            { key: "category", value: body.category } // Added this
          ],
        },
      },
    });

    const data: any = await response.json();
    const errors = data?.data?.metaobjectCreate?.userErrors;

    if (errors?.length) return json({ success: false, error: errors[0].message });
    return json({ success: true });

  } catch (error: any) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}