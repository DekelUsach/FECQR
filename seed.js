const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://atjcpyehqpbtsmvfvayc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0amNweWVocXBidHNtdmZ2YXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4NDIxMSwiZXhwIjoyMDg5MjYwMjExfQ.uN0Doc1F96zbnYw37SgRoT5chOvtlBHnNwJbGY_OLdo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createProf() {
  console.log('Creando profesor...');
  
  // 1. Crear el usuario
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'profesor@test.com',
    password: 'password123',
    email_confirm: true
  });
  
  if (error) {
     if(error.message.includes('already exists')) {
       console.log('El usuario ya existe, intentando continuar para materias...');
     } else {
       console.error('Error creando usuario:', error);
       return;
     }
  }
  
  // Busca el user_id
  let userId = data?.user?.id;
  if(!userId) {
     console.log('Buscando al usuario profesor@test.com...');
     const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
     const user = listData.users.find(u => u.email === 'profesor@test.com');
     if(user) userId = user.id;
  }
  
  if(!userId) {
     console.log('No se pudo resolver el user ID');
     return;
  }
  
  console.log('User ID:', userId);
  
  // 2. Crear las materias
  const resMat1 = await supabase.from('materias').insert({ nombre: 'Matemática Avanzada', profesor_id: userId }).select();
  const resMat2 = await supabase.from('materias').insert({ nombre: 'Programación Web', profesor_id: userId }).select();
  
  console.log('Materias insertadas:', resMat1.data, resMat2.data);
  
  if(resMat1?.data?.[0] && resMat2?.data?.[0]) {
     // 3. Crear los estudiantes de prueba
     await supabase.from('alumnos').insert([
       { materia_id: resMat1.data[0].id, nombre: 'Juan Pérez' },
       { materia_id: resMat1.data[0].id, nombre: 'Ana Gómez' },
       { materia_id: resMat2.data[0].id, nombre: 'Carlos López' },
     ]);
     console.log('Estudiantes insertados con éxito.');
  }
}

createProf();
