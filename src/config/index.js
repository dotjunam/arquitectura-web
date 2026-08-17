/** Configuracion central de la aplicacion, leida del entorno con valores por defecto. */

export const config = {
  port: Number(process.env.PORT ?? 3000),
  // Se versiona la API desde el principio: cambiar el contrato mas adelante no
  // deberia romper a los clientes que ya consumen la version anterior.
  apiPrefix: '/api/v1',
  // Tope de tamano del body: evita que un pedido enorme ocupe memoria al pedo.
  bodyLimit: '100kb',
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};
