import { json }
from "@remix-run/node";

import {
  useLoaderData
}
from "react-router";

import {
  authenticate
}
from "../shopify.server";

export async function loader({
  request
}: any) {

  const { admin } =
    await authenticate.admin(
      request
    );

  return json({
    success: true
  });

}

export default function Campaigns() {

  const data =
    useLoaderData<any>();

  return (

    <div
      style={{
        padding: "40px"
      }}
    >

      <h1>
        Shopify Auth Working
      </h1>

      <pre>
        {
          JSON.stringify(
            data,
            null,
            2
          )
        }
      </pre>

    </div>

  );

}