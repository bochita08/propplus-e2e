import { S, byId, demoUser } from '../../shared/selectors';
import { irALogin, ocultarTeclado } from '../../shared/app';
import { escribirEn, tocar, verTexto } from '../../shared/actions';

describe('PROP+ · Login', () => {
  beforeEach(irALogin);

  it('email sin @ muestra el error debajo del input', async () => {
    await escribirEn('el campo Email', byId(S.signIn.email), 'demopropplus.com');
    await ocultarTeclado();
    await tocar('el campo Contraseña (para salir del email)', byId(S.signIn.password));
    await verTexto('El email debe contener un @.');
  });

  it('contraseña vacía muestra el error al enviar', async () => {
    await escribirEn('el campo Email', byId(S.signIn.email), demoUser.email);
    await ocultarTeclado();
    await tocar('el botón Ingresar', byId(S.signIn.submit));
    await verTexto('La contraseña es obligatorio.');
  });

  it('credenciales incorrectas muestra el banner de error', async () => {
    await escribirEn('el campo Email', byId(S.signIn.email), demoUser.email);
    await escribirEn('el campo Contraseña', byId(S.signIn.password), 'ClaveMala9');
    await ocultarTeclado();
    await tocar('el botón Ingresar', byId(S.signIn.submit));
    await verTexto('Email o contraseña incorrectos.');
  });

  it('entra con la cuenta demo y llega al listado', async () => {
    await escribirEn('el campo Email', byId(S.signIn.email), demoUser.email);
    await escribirEn('el campo Contraseña', byId(S.signIn.password), demoUser.password);
    await ocultarTeclado();
    await tocar('el botón Ingresar', byId(S.signIn.submit));
    await verTexto('5 propiedades');
  });
});
