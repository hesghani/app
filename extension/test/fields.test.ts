import { bulletsToDescription, classifyField, fillListing, findAndReplace, findListingFields } from '../src/content/merch/fields';

function form() {
  document.body.innerHTML = `
    <input placeholder="Search designs">
    <div class="form-group"><label for="b">Brand name</label><input id="b" type="text"></div>
    <section data-lang="en">
      <mat-form-field><label>Product title</label><input formcontrolname="title"></mat-form-field>
      <textarea aria-label="Feature bullet 1 (optional)"></textarea>
      <textarea aria-label="Feature bullet 2 (optional)"></textarea>
      <textarea id="d1" placeholder="Product description"></textarea>
    </section>
    <section data-lang="de">
      <input name="title_de" placeholder="Title (German)">
      <textarea name="bullet_de_1" placeholder="Key product features"></textarea>
      <textarea name="bullet_de_2" placeholder="Key product features"></textarea>
      <textarea name="description_de"></textarea>
    </section>
    <input aria-label="List price">`;
  return findListingFields(document, true);
}

describe('Merch listing fields', () => {
  it('classifies fields by their labels', () => {
    expect(classifyField('brand name')).toBe('brand');
    expect(classifyField('product title')).toBe('title');
    expect(classifyField('feature bullet 1 (optional)')).toBe('bullet');
    expect(classifyField('product description')).toBe('description');
    expect(classifyField('search designs')).toBeNull();
    expect(classifyField('list price')).toBeNull();
    const kinds = form().map((f) => f.kind);
    expect(kinds).toEqual(['brand', 'title', 'bullet', 'bullet', 'description', 'title', 'bullet', 'bullet', 'description']);
  });

  it('fills every language listing and fires input events', () => {
    const fields = form();
    let inputs = 0;
    document.body.addEventListener('input', () => inputs++);
    const filled = fillListing(fields, { brand: 'Dinkworthy', title: 'Pickleball Legend', bullet1: 'One', bullet2: 'Two', description: 'Desc' });
    expect(filled).toBe(9);
    expect(inputs).toBe(9);
    expect((document.getElementById('b') as HTMLInputElement).value).toBe('Dinkworthy');
    expect((document.querySelector('[name="bullet_de_2"]') as HTMLTextAreaElement).value).toBe('Two');
  });

  it('copies bullets into each description and finds/replaces', () => {
    const fields = form();
    fillListing(fields, { brand: 'B', title: 'Cat Tee', bullet1: 'Funny cat gift', bullet2: 'Great for cat moms!', description: '' });
    expect(bulletsToDescription(fields)).toBe(2);
    expect((document.getElementById('d1') as HTMLTextAreaElement).value).toBe('Funny cat gift. Great for cat moms!');
    expect(findAndReplace(fields, 'cat', 'dog')).toBeGreaterThan(3);
    expect((document.getElementById('d1') as HTMLTextAreaElement).value).toBe('Funny dog gift. Great for dog moms!');
  });
});
