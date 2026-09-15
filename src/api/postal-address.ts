export async function findPostalAddress(cep: string, signal: AbortSignal): Promise<string> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("Informe os 8 dígitos do CEP.");
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) throw new Error("Não foi possível buscar o CEP. Tente novamente.");
  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado. Confira ou preencha o endereço manualmente.");
  if (typeof data.localidade !== "string" || typeof data.uf !== "string") {
    throw new Error("Não foi possível consultar o endereço.");
  }
  return [data.logradouro, data.bairro, `${data.localidade} - ${data.uf}`, `CEP ${digits.slice(0, 5)}-${digits.slice(5)}`]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
}
