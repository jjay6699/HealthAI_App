export type ShippingAddressRecord = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  country?: string;
  city: string;
  state: string;
  postcode: string;
  specialInstructions?: string;
  isDefault: boolean;
};

export const fetchShippingAddresses = async () => {
  const response = await fetch("/api/shipping-addresses", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.addresses)
    ? (payload.addresses as ShippingAddressRecord[])
    : [];
};

export const saveShippingAddresses = async (addresses: ShippingAddressRecord[]) => {
  const response = await fetch("/api/shipping-addresses", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ addresses })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.addresses)
    ? (payload.addresses as ShippingAddressRecord[])
    : [];
};
