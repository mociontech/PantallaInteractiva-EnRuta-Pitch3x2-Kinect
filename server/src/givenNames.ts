/**
 * Nombres de pila comunes (minúsculas, sin tildes). Solo sirven para desempatar al separar apellidos y nombres
 * cuando la base viene como "APELLIDOS NOMBRES" y el nombre tiene 3 o 5 palabras ("LOPEZ ANA MARIA" vs "PEREZ GOMEZ ANA").
 * No hace falta que esté completa: lo que no esté se trata como apellido.
 */
const LIST = `
adriana alba alejandra alexandra alicia alix alma amalia amanda amparo ana andrea angela angelica angie anny antonia
aracely astrid aura aurora beatriz belen berta blanca brenda camila carina carla carlota carmen carolina catalina cecilia
celia cielo clara claudia clemencia cristina dagmar daniela dayana deisy diana dina dolores doris edith elena eliana elisa
elizabeth elsa elvira emilia emma erika esperanza estefania estella esther eugenia eva fabiola fanny fatima felisa fernanda
flor florencia francia francisca gabriela gladys gloria graciela greta guadalupe helena herminia ines irene iris isabel
ivonne jackeline jaqueline jazmin jenny jessica joana johana johanna josefa josefina juana judith julia juliana julieta
karen karina katherine katerine kelly laura leidy leonor leticia lidia liliana lina linda lisbeth liseth lizeth lorena lucia
luisa luz lyda magaly manuela marcela margarita maria mariana maribel marina marisol marta martha mayra melissa mercedes
michelle milena mirella miriam mónica monica nancy natalia nelly nidia nora norma olga olivia paola patricia paula pilar
priscila rafaela raquel rebeca regina rocio rosa rosario ruth sandra sara sarah sharon shirley silvia sofia sonia soraya
stefany stella susana tatiana teresa valentina valeria vanessa vera veronica victoria viviana wendy ximena yamile yaneth
yenny yesenia yolanda yuliana yulieth zulma
abel abraham adolfo adrian agustin alan albeiro alberto alejandro alexander alexis alfonso alfredo alirio alonso alvaro
amado ambrosio andres angel anibal antonio arcadio ariel armando arturo augusto aurelio benjamin bernardo bladimir boris
bruno camilo carlos cesar christian clemente cristian cristobal damian daniel dario david diego dilan dionisio edgar edgardo
edilberto edison eduardo edwin efrain elias eliecer emiliano emilio enrique ernesto esteban eugenio eusebio ezequiel
fabian fabio federico felipe fernando fidel francisco frank fredy freddy gabriel gerardo german gilberto giovanni gonzalo
gregorio guillermo gustavo harold hector helmer henry hernan hernando hugo humberto ignacio ivan jaime javier jean jeison
jefferson jeronimo jesus jhon jhonatan jhonny joaquin joel jonathan jorge jose josue juan julian julio justo kevin leandro
leonardo leon lorenzo lucas luis manuel marco marcos mario mateo mauricio maximiliano miguel milton moises nelson nestor
nicolas noel norberto octavio omar orlando oscar osvaldo pablo pedro rafael ramiro ramon raul reinaldo ricardo roberto
rodolfo rodrigo rogelio roman ruben salvador samuel santiago saul sebastian sergio simon stiven steven tomas ulises
valentin vicente victor wilfredo william wilmer wilson yeison yeferson yesid yovany

adaulfo aled alcides andreina angy anyelli anais audis auria carmelo cindy cristy cyndi davinson dayarlin deysy dibeth edelangel
eidin elsy eloy etervina fares geraldine gina ginna indira isabella ismenia jelissa jesica joice john jossiet katty katy kelis
kerlyn kimberly kleiver karoll lesmen ladys liz mariano marian maura melisa mery meyler neder nadir nur oswaldo sayuri sirly
stefanny surys tanie tivisay xilena xiomara yandrys yerly yessica yeicy yolvis alison amaury jorsuar
`;

export const GIVEN_NAMES: ReadonlySet<string> = new Set(LIST.split(/\s+/).filter(Boolean));

export function isGivenName(word: string): boolean {
  return GIVEN_NAMES.has(word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}
