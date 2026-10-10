using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace DecisionWorkspace.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DecisionsController : ControllerBase
    {
        private readonly DecisionService _decisionService;

        public DecisionsController(DecisionService decisionService)
        {
            _decisionService = decisionService;
        }

        private Guid GetUserId()
        {
            var userId = User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userId, out var parsedUserId))
            {
                throw new UnauthorizedAccessException(
                    "Invalid user ID."
                );
            }

            return parsedUserId;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateDecisionRequest request)
        {
            var decision = await _decisionService.CreateAsync(
                GetUserId(),
                request
            );

            return Ok(decision);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var decisions = await _decisionService.GetAllAsync(
                GetUserId()
            );

            return Ok(decisions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var decision = await _decisionService.GetByIdAsync(
                GetUserId(),
                id
            );

            if (decision == null)
            {
                return NotFound();
            }

            return Ok(decision);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(
            Guid id,
            CreateDecisionRequest request
        )
        {
            var decision = await _decisionService.UpdateAsync(
                GetUserId(),
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
            var deleted = await _decisionService.DeleteAsync(
                GetUserId(),
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