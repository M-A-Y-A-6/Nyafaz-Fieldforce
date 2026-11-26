/**
 * Formats an address string cleanly:
 * - Appends `, ${city}` only when `city` is non-empty and not already contained in `address`.
 * - Trims whitespace and prevents duplicate city names.
 */
export const formatAddress = (address, city) => {
  const cleanAddress = (address || '').trim();
  const cleanCity = (city || '').trim();

  if (!cleanAddress && !cleanCity) return 'Address on record';
  if (!cleanAddress) return cleanCity;
  if (!cleanCity) return cleanAddress;

  // Case-insensitive check to avoid duplicate city
  if (cleanAddress.toLowerCase().includes(cleanCity.toLowerCase())) {
    return cleanAddress;
  }

  return `${cleanAddress}, ${cleanCity}`;
};
