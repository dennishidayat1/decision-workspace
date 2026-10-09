using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DecisionsController : ControllerBase
    {
        private readonly DecisionService _decisionService;
        public DecisionsController(DecisionService decisionService)
        {
            _decisionService = decisionService;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateDecisionRequest request)
        {
            var decision = await _decisionService.CreateAsync(request);

            return Ok(decision);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var decisions = await _decisionService.GetAllAsync();

            return Ok(decisions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var decision = await _decisionService.GetByIdAsync(id);

            if (decision == null)
            {
                return NotFound();
            }

            return Ok(decision);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, CreateDecisionRequest request)
        {
            var decision =
                await _decisionService.UpdateAsync(
                    id,
                    request
                );

            if (decision == null)
            {
                return NotFound();
            }

            return Ok(decision);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var deleted =
                await _decisionService.DeleteAsync(
                    id
                );

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
    }
}
