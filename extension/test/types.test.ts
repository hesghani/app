import { productTypeFromLabel } from '../src/shared/products';

describe("Merch's product type names", () => {
  it.each([
    ['STANDARD_TSHIRT', 'STANDARD_TSHIRT'],
    ['STANDARD_SWEATSHIRT', 'SWEATSHIRT'],
    ['STANDARD_PULLOVER_HOODIE', 'HOODIE'],
    ['STANDARD_ZIP_HOODIE', 'ZIP_HOODIE'],
    ['PERFORMANCE_HOODIE', 'PERFORMANCE_HOODIE'],
    ['TANK_TOP', 'TANK'],
    ['STANDARD_LONG_SLEEVE', 'LONG_SLEEVE'],
    ['RAGLAN', 'RAGLAN'],
    ['STANDARD_V_NECK', 'VNECK'],
    ['PREMIUM_TSHIRT', 'PREMIUM_TSHIRT'],
    ['VALUE_TSHIRT', 'VALUE_TSHIRT'],
    ['PERFORMANCE_TSHIRT', 'PERFORMANCE_TSHIRT'],
    ['PRINTED_TRUCKER_HAT', 'TRUCKER_HAT'],
    ['PRINTED_BASEBALL_HAT', 'BASEBALL_HAT'],
    ['SOFTSHELL_JACKET', 'JACKET'],
    ['POP_SOCKET', 'POPSOCKET'],
    ['APPLE_IPHONE_CASE', 'PHONE_CASE'],
    ['TOTE_BAG', 'TOTE'],
    ['THROW_PILLOW', 'PILLOW'],
    ['MUG', 'MUG'],
    ['Standard t-shirt', 'STANDARD_TSHIRT'],
    ['Pullover Hoodie', 'HOODIE'],
    ['Sweatshirt', 'SWEATSHIRT'],
  ])('%s → %s', (label, type) => {
    expect(productTypeFromLabel(label)).toBe(type);
  });
});
