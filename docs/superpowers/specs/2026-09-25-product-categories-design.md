# Catálogo de categorias de produto

## Objetivo

Substituir a categoria textual por um catálogo plano, pesquisável e persistido por distribuidora, com criação explícita por pessoas que podem editar produtos.

## Dados e migração

- `ProductCategory` pertence a um tenant e armazena `id`, `tenantId`, `name`, `normalizedName`, `active`, `createdAt` e `updatedAt`.
- A unicidade é `(tenantId, normalizedName)`; a normalização remove acentos, espaços externos/repetidos e diferenciação de caixa.
- `Product` referencia `categoryId`. A migration cria categorias a partir de valores existentes de `products.category`, associa os produtos, e só então remove a coluna textual.
- Ao criar uma distribuidora, o backend insere o catálogo inicial de bebidas uma vez, na mesma transação do tenant.

## API e autorização

- `GET /products/categories` lista categorias ativas da distribuidora autenticada.
- `POST /products/categories` recebe nome, normaliza, cria ou retorna conflito claro para duplicata e exige `PRODUCTS:WRITE`.
- Criar e editar produto recebem `categoryId`; o serviço rejeita categoria inativa ou pertencente a outro tenant.

## Interface

- O cadastro usa um combobox de categorias com busca sem acento, teclado, carregamento, estado vazio e seleção por id.
- Sem correspondência exata, oferece criar a nova categoria; o retorno é selecionado automaticamente.
- A taxonomia é plana e contém categorias de bebidas, não bebidas e itens operacionais definidos na crítica.

## Limites

Não há hierarquia, aprovação de categoria, categorias por filial nem alteração de permissões existentes. O backend continua sendo a fonte de verdade.
