import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { termSchema } from "../../src/data/schemas";

const expectedMeshDescriptors = {
  adenomyoma: "D018194",
  adenomyosis: "D062788",
  analgesia: "D000698",
  angiocardiography: "D000790",
  angiofibroma: "D018322",
  angioscopy: "D017546",
  ankyloglossia: "D000072676",
  aortography: "D001027",
  arthrography: "D001175",
  blepharoplasty: "D019882",
  capnography: "D019296",
  cardiology: "D002309",
  cholecystectomy: "D002763",
  cholecystography: "D002765",
  cholecystostomy: "D002767",
  colectomy: "D003082",
  colostomy: "D003125",
  cystocele: "D052858",
  cystography: "D000070621",
  dacryocystography: "D000090104",
  dermatofibrosarcoma: "D018223",
  dysphonia: "D055154",
  endocytosis: "D004705",
  endoderm: "D004707",
  endolymph: "D004710",
  endoscopy: "D004724",
  endotoxemia: "D019446",
  fasciotomy: "D000071938",
  fibroadenoma: "D018226",
  gastroenterology: "D005762",
  gastroenterostomy: "D005763",
  hemangioblastoma: "D018325",
  hematology: "D006405",
  hemolymph: "D006458",
  hepatoblastoma: "D018197",
  hidradenitis: "D016575",
  hyperplasia: "D006965",
  hypoalbuminemia: "D034141",
  hypocapnia: "D016857",
  hypohidrosis: "D007007",
  keratectomy: "D000074431",
  keratitis: "D007634",
  keratosis: "D007642",
  laryngocele: "D059608",
  lymph: "D008196",
  lymphadenitis: "D008199",
  lymphadenopathy: "D000072281",
  lymphocele: "D008210",
  lymphocytosis: "D008218",
  lymphography: "D008220",
  lymphoma: "D008223",
  mastodynia: "D059373",
  myelitis: "D009187",
  myelography: "D009192",
  myocarditis: "D009205",
  myofibroma: "D047708",
  myography: "D009213",
  myosarcoma: "D009217",
  myotonia: "D009222",
  nephrology: "D009398",
  nephrosclerosis: "D009400",
  nephrosis: "D009401",
  neuroblastoma: "D009447",
  neurocytoma: "D018306",
  neurodermatitis: "D009450",
  neurofibroma: "D009455",
  neurofibrosarcoma: "D018319",
  neurotology: "D063165",
  osteoblastoma: "D018215",
  osteochondritis: "D010007",
  osteochondroma: "D015831",
  osteochondrosis: "D055034",
  osteology: "D059166",
  osteosarcoma: "D012516",
  ostomy: "D010030",
  otolaryngology: "D010036",
  otosclerosis: "D010040",
  periarthritis: "D010489",
  pericardiectomy: "D010492",
  perilymph: "D010498",
  perinephritis: "D010501",
  phonocardiography: "D010701",
  pneumonectomy: "D011013",
  pneumonia: "D011014",
  sarcocystosis: "D012523",
  sarcoma: "D012509",
  sclerosis: "D012598",
  spasm: "D013035",
  tachypnea: "D059246",
  thorax: "D013909",
  thrombectomy: "D017131",
  thrombocytosis: "D013922",
  thrombosis: "D013927",
  toxemia: "D014115",
} as const;

describe("medical word list import", () => {
  it("Given the filtered source list, when authored terms are loaded, then every approved MeSH descriptor is present exactly once", () => {
    // Given
    const terms = readdirSync(join(process.cwd(), "data", "terms"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => termSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "terms", entry.name), "utf8"))));

    // When
    const imported = terms.flatMap((term) => term.externalIds?.meshDescriptor === undefined
      ? []
      : [[term.normalized, term.externalIds.meshDescriptor] as const]);

    // Then
    expect(Object.fromEntries(imported)).toEqual(expectedMeshDescriptors);
    expect(imported).toHaveLength(Object.keys(expectedMeshDescriptors).length);
  });
});
