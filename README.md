# Torneo Catán — generador de mapas

Aplicación web sin backend para crear mapas reproducibles y equilibrados del tablero base de Catán. Para usarla, sirve esta carpeta desde un servidor web local o publícala mediante GitHub Pages.

## Funcionamiento de la página

1. **Semilla:** cada texto identifica un mapa completo. La misma semilla siempre genera los mismos terrenos, fichas y puertos.
2. **Generar mapa:** crea otra distribución usando la semilla escrita. El botón circular genera antes una semilla nueva.
3. **Letras:** muestra las letras del reverso de las fichas numéricas para preparar el tablero sin revelar los números.
4. **Revelar:** sustituye las letras por los números y muestra sus puntos de probabilidad.
5. **Mostrar puertos:** añade o retira los nueve puertos del mapa.
6. **Copiar semilla:** copia el identificador para repetir el tablero en otra mesa.
7. **Descargar PNG:** guarda únicamente el mapa, respetando si están visibles las letras o los números y si se muestran los puertos. El archivo se genera a 2700 × 2160 píxeles.

## Componentes del mapa

- 19 terrenos: 4 bosques, 4 pastos, 4 cultivos, 3 colinas, 3 montañas y 1 desierto.
- 18 fichas numéricas, una por cada terreno productor.
- 9 puertos: cuatro puertos 3:1 y uno de cada recurso —madera, lana, trigo, ladrillo y mineral—.

Las letras corresponden a los números impresos en el reverso de las fichas:

| Letra | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Número | 5 | 2 | 6 | 3 | 8 | 10 | 9 | 12 | 11 | 4 | 8 | 10 | 9 | 4 | 5 | 6 | 3 | 11 |

## Cómo se genera un mapa

La semilla se convierte en un número y alimenta un generador pseudoaleatorio determinista. Por eso una misma semilla produce siempre el mismo resultado.

### 1. Distribución de terrenos

El programa baraja los 19 terrenos y prueba hasta 2500 distribuciones. Se acepta la primera en la que ningún recurso forma un bloque conectado de tres o más hexágonos iguales. El desierto no participa en esta comprobación.

### 2. Pesos de probabilidad

Cada número recibe un peso según la cantidad de combinaciones con las que puede obtenerse al lanzar dos dados:

| Número | 2 / 12 | 3 / 11 | 4 / 10 | 5 / 9 | 6 / 8 |
|---|---:|---:|---:|---:|---:|
| Peso | 1 | 2 | 3 | 4 | 5 |

El peso total de un recurso es la suma de los pesos de todas sus fichas. Por ejemplo, un bosque con 6, 9 y 11 aporta `5 + 4 + 2 = 11` puntos.

### 3. Colocación de fichas numéricas

Para cada distribución de terrenos se prueban hasta 25 000 órdenes de las letras A–R. Una colocación se considera equilibrada cuando cumple todas estas reglas:

- Los números rojos 6 y 8 nunca comparten arista.
- Bosque, pastos y cultivos tienen entre 9 y 15 puntos de peso cada uno.
- Colinas y montañas tienen entre 7 y 12 puntos de peso cada uno.
- Un mismo recurso no recibe más de dos fichas rojas.
- Ningún vértice alcanza más de 13 puntos de peso sumando sus dos o tres hexágonos adyacentes.

El primer orden que cumple todas las condiciones se utiliza en el mapa. Si se agotara el límite de intentos, la aplicación usa una distribución completa de respaldo para no bloquear la generación.

### 4. Puertos

Los nueve tipos de puerto se barajan con la misma semilla. Después se asignan a nueve aristas costeras diferentes, repartidas regularmente alrededor de la isla. La arista correspondiente aparece resaltada y conectada visualmente con su marcador.

## Notas

- La aplicación no utiliza datos externos ni necesita un servidor de aplicación.
- Las ilustraciones de terrenos y recursos están incluidas en `assets/`.
- Es una herramienta no oficial para la organización de torneos.
